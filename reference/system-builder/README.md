# System Builder Reference Manuals

System Builder manuals are first-class D3Code references alongside the Rocket D3 reference manual, D3 user guide, and Rocket MV BASIC material.

Current manual:

- `../SBXA_SBPlusSolutionsDeveloperGuide_V656.pdf` - **SB+ Solutions**, legacy guide, edition unverified. The cover gives copyright 1996-2010; the PDF metadata identifies a 2010 web capture. The retained filename does not establish SB/XA version 6.5.6.

Use these references before changing or explaining System Builder screens, menus, generated routines, templates, reports, or SB/XA application behavior.

Match the guide to the actual installation before using record layouts. Native D3, SB, legacy SB+ and SB/XA are not interchangeable. Current versioned SB/XA material is available in [Rocket's official developer documentation](https://docs.rocketsoftware.com/bundle/sbxa_dg_656/page/ukp1644327725990.html).

Do not use `RUN DM SB.INITIATE` as an installation probe. This guide describes it as an account installer that catalogs programs, creates pointers and overwrites the account logon procedure. Read-only pointers and filenames are evidence of references, not proof of a working runtime.

After changing this manifest, run `d3code rag-build` from the intended workspace to refresh its reference cache. Existing cache freshness checks track source files, not manifest metadata.
