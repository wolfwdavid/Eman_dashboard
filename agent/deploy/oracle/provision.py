"""Provision the Always Free ARM VM for the DID agent on Oracle Cloud (idempotent).

Run with the OCI CLI venv python after `oci session authenticate`:
    python provision.py
Creates (or reuses by display name): VCN 10.0.0.0/16, internet gateway, default route,
ingress 22/80/443 on the default security list, public subnet 10.0.0.0/24, and a
VM.Standard.A1.Flex (4 OCPU / 24 GB) Ubuntu 24.04 aarch64 instance with cloud-init.yaml.
Tries each availability domain until one has A1 capacity. Writes state.json (no secrets).
"""
from __future__ import annotations
import json, sys, time
from pathlib import Path
import oci

HERE = Path(__file__).resolve().parent
NAME = "did-agent"
SSH_PUB = Path.home() / ".ssh" / "did-agent-oci.pub"

cfg = oci.config.from_file(profile_name="DEFAULT")
signer = oci.auth.signers.SecurityTokenSigner(
    open(cfg["security_token_file"]).read(), oci.signer.load_private_key_from_file(cfg["key_file"]))
ten = cfg["tenancy"]
iam = oci.identity.IdentityClient(cfg, signer=signer)
net = oci.core.VirtualNetworkClient(cfg, signer=signer)
comp = oci.core.ComputeClient(cfg, signer=signer)
state = json.loads((HERE / "state.json").read_text()) if (HERE / "state.json").exists() else {}

def save():
    (HERE / "state.json").write_text(json.dumps(state, indent=2) + "\n")

def first(items, **match):
    for it in items:
        if all(getattr(it, k) == v for k, v in match.items()) and it.lifecycle_state not in ("TERMINATED", "TERMINATING"):
            return it
    return None

# --- network ---
vcn = first(net.list_vcns(ten).data, display_name=f"{NAME}-vcn")
if not vcn:
    vcn = net.create_vcn(oci.core.models.CreateVcnDetails(
        compartment_id=ten, cidr_block="10.0.0.0/16", display_name=f"{NAME}-vcn", dns_label="didagent")).data
    oci.wait_until(net, net.get_vcn(vcn.id), "lifecycle_state", "AVAILABLE")
print("vcn", vcn.id[-12:])
igw = first(net.list_internet_gateways(ten, vcn_id=vcn.id).data, display_name=f"{NAME}-igw")
if not igw:
    igw = net.create_internet_gateway(oci.core.models.CreateInternetGatewayDetails(
        compartment_id=ten, vcn_id=vcn.id, is_enabled=True, display_name=f"{NAME}-igw")).data
    oci.wait_until(net, net.get_internet_gateway(igw.id), "lifecycle_state", "AVAILABLE")
print("igw", igw.id[-12:])
rt = net.get_route_table(vcn.default_route_table_id).data
if not any(r.network_entity_id == igw.id for r in rt.route_rules):
    net.update_route_table(rt.id, oci.core.models.UpdateRouteTableDetails(route_rules=rt.route_rules + [
        oci.core.models.RouteRule(destination="0.0.0.0/0", destination_type="CIDR_BLOCK", network_entity_id=igw.id)]))
print("route ok")
sl = net.get_security_list(vcn.default_security_list_id).data
have = {(r.tcp_options.destination_port_range.min if r.tcp_options and r.tcp_options.destination_port_range else None) for r in sl.ingress_security_rules}
new_rules = list(sl.ingress_security_rules)
for port in (22, 80, 443):
    if port not in have:
        new_rules.append(oci.core.models.IngressSecurityRule(
            protocol="6", source="0.0.0.0/0", source_type="CIDR_BLOCK", is_stateless=False,
            tcp_options=oci.core.models.TcpOptions(destination_port_range=oci.core.models.PortRange(min=port, max=port)),
            description=f"did-agent {port}"))
if len(new_rules) != len(sl.ingress_security_rules):
    net.update_security_list(sl.id, oci.core.models.UpdateSecurityListDetails(ingress_security_rules=new_rules))
print("security list ok (22/80/443)")
sub = first(net.list_subnets(ten, vcn_id=vcn.id).data, display_name=f"{NAME}-public")
if not sub:
    sub = net.create_subnet(oci.core.models.CreateSubnetDetails(
        compartment_id=ten, vcn_id=vcn.id, cidr_block="10.0.0.0/24", display_name=f"{NAME}-public",
        dns_label="pub", prohibit_public_ip_on_vnic=False)).data
    oci.wait_until(net, net.get_subnet(sub.id), "lifecycle_state", "AVAILABLE")
print("subnet", sub.id[-12:])
state.update(vcn_id=vcn.id, subnet_id=sub.id); save()

# --- instance ---
inst = first(comp.list_instances(ten, display_name=NAME).data, display_name=NAME)
if not inst:
    image = comp.list_images(ten, operating_system="Canonical Ubuntu", operating_system_version="24.04",
                             shape="VM.Standard.A1.Flex", sort_by="TIMECREATED", sort_order="DESC").data[0]
    import base64
    user_data = base64.b64encode((HERE / "cloud-init.yaml").read_bytes()).decode()
    ads = [a.name for a in iam.list_availability_domains(ten).data]
    last_err = None
    for ad in ads:
        try:
            inst = comp.launch_instance(oci.core.models.LaunchInstanceDetails(
                compartment_id=ten, availability_domain=ad, display_name=NAME,
                shape="VM.Standard.A1.Flex",
                shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(ocpus=4, memory_in_gbs=24),
                source_details=oci.core.models.InstanceSourceViaImageDetails(image_id=image.id, boot_volume_size_in_gbs=50),
                create_vnic_details=oci.core.models.CreateVnicDetails(subnet_id=sub.id, assign_public_ip=True, hostname_label="didagent"),
                metadata={"ssh_authorized_keys": SSH_PUB.read_text().strip(), "user_data": user_data},
            )).data
            print("launched in", ad, "image", image.display_name)
            break
        except oci.exceptions.ServiceError as e:
            last_err = e
            print(f"{ad}: {e.code} - {str(e.message)[:120]}")
    if not inst:
        print("NO CAPACITY in any AD; rerun later. last:", last_err.code if last_err else None); sys.exit(2)
state["instance_id"] = inst.id; save()
inst = oci.wait_until(comp, comp.get_instance(inst.id), "lifecycle_state", "RUNNING", max_wait_seconds=600).data
vnic_id = comp.list_vnic_attachments(ten, instance_id=inst.id).data[0].vnic_id
ip = net.get_vnic(vnic_id).data.public_ip
state.update(public_ip=ip, availability_domain=inst.availability_domain, shape=inst.shape); save()
print("RUNNING", inst.display_name, "public_ip", ip)
