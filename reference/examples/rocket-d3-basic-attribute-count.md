# Rocket D3 BASIC attribute count with DCOUNT and @AM

To count attributes in a D3 record, use `DCOUNT(RECORD, @AM)` directly.
In Rocket D3, `DCOUNT` already adds one to the delimiter count for a
nonempty string and returns zero for an empty string. Adding one yourself
would overcount. For example, `DCOUNT("A":@AM:"B":@AM:"C", @AM)` returns 3.

A read-only D3 BASIC program can `OPEN` the file, `READ` the item into
`RECORD`, and print `DCOUNT(RECORD, @AM)` after a successful read. The
count establishes how many attribute positions the record contains.
Confirm what those positions mean from the application definitions.

Source: Rocket D3 Reference Manual 10.3.4,
`d3_reference_manual_10.3.4_5-28-2026.pdf`, pages 269-270, `dcount()`.
