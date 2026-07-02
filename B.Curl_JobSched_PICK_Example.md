# B.JOBSCHED PICK BASIC curl example

This is the replacement block for the empty `* curl command` section after:

```pick
  jskey      = '00_jobschedule.txt'
  write pline on datapost,jskey
```

It writes the generated schedule to the UNIX host file `/tmp/job schedule.txt`, then posts that file to Cape Town branch code `00`.

```pick
* curl command
  api.url     = 'https://dpp.multisnack.co.za/api/dpp/jobs/upload'
  api.token   = '4ffcb58ed50970d12b5fff5e47af26fd7905c74ed25332c5265cbc0b7802aeb6'
  branch.code = '00'
  unix.dir    = '/tmp'
  unix.item   = 'job schedule.txt'
  unix.path   = unix.dir:'/':unix.item
  unix.qptr   = 'MSJOBS.TMP'

* Create/open a D3 OSFI Q-pointer to the UNIX directory.
* OSFI converts D3 attribute marks to UNIX newlines by default when writing.
  open 'MD' to md.file else
    call disp(3,'Cannot open MD file for UNIX Q-pointer')
    goto 90
  end

  read md.rec from md.file,unix.qptr else
    md.rec    = 'Q'
    md.rec<2> = ''
    md.rec<3> = 'unix:':unix.dir
    write md.rec on md.file,unix.qptr
  end

  open unix.qptr to unix.file else
    call disp(3,'Cannot open UNIX directory ':unix.dir)
    goto 90
  end

  write pline on unix.file,unix.item

* Post the UNIX file as multipart field "document" for Cape Town branch 00.
* D3 BASIC executes UNIX commands with EXECUTE "!command".
  dq       = char(34)
  cmd      = '!curl -sS -X POST ':dq:api.url:dq:' '
  cmd     := '-H ':dq:'Authorization: Bearer ':api.token:dq:' '
  cmd     := '-F ':dq:'document=@':unix.path:dq:' '
  cmd     := '-F ':dq:'branch_code=':branch.code:dq

  execute cmd capturing cap returning ret
  if ret # 0 then
    call disp(3,'Job schedule upload failed. curl exit code ':ret)
    crt cap
    goto 90
  end
```

The resulting HTTP request is equivalent to:

```bash
curl -X POST 'https://dpp.multisnack.co.za/api/dpp/jobs/upload' \
  -H 'Authorization: Bearer 4ffcb58ed50970d12b5fff5e47af26fd7905c74ed25332c5265cbc0b7802aeb6' \
  -F 'document=@/tmp/job schedule.txt' \
  -F 'branch_code=00'
```

References checked:

- Rocket D3 `EXECUTE "!unix.command"` syntax supports executing UNIX commands from BASIC and returning the UNIX exit code.
- Rocket D3 OSFI host operating system files map D3 items to UNIX files and convert attribute marks to newline characters by default.
- The DPP API documentation screenshot specifies multipart field `document`, `branch_code=00`, and endpoint `/api/dpp/jobs/upload`.
