# The DWG lane — which converter ships

[Ticket](../tickets/05-the-dwg-lane.md) · ruled 2026-08-13 · [ADR-0012](../../../docs/adr/0012-the-dwg-lane-is-audited-not-trusted.md)

LibreDWG stays at $0 and the lane becomes **two passes, audited not trusted** (ADR-0012,
superseding ADR-0001's converter clause): `dwgread -O JSON` census reconciled per type against the
`dwg2dxf` DXF, every shortfall a named refusal. Measured on 139 corpus DWGs against 34
AutoCAD-authored twins: **139/139 exit 0** including 16 empty-or-unreadable outputs, **−2.41%**
entity recovery on 31 modern pairs — and **every loss visible in the census**, which is what made
the free converter shippable. ODA is licensable at **$7,500/$4,500 yr** but unmeasured, so it is
priced with a named purchase trigger, not bought; ODA File Converter's dev-only permission is
*withdrawn*. Rejected: buying ODA now, shipping the `--enable-debug` build, refusing DWG wholesale.
