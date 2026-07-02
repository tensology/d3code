# Crystal Logic — Rocket D3 pick0 service (Linux)

Operator notes for **office.crystallogic.org** and similar Crystal Logic D3 hosts.

## When D3 is not running

Enable and start D3 as a systemd service at boot:

```bash
systemctl enable --now d3_pick0.service
```

Use `enable --now` only when D3 is **not** already running. Do not run this if the pick0 VM is already up.

## Restart D3 (service already installed)

```bash
systemctl stop d3_pick0.service
systemctl start d3_pick0.service
```

## Symptoms in D3 Code

SSH may succeed while TCL fails with messages like:

- `Virtual Machine 'pick0:LINUX' is not running`
- `Connection closed`

In that case, start or restart `d3_pick0.service` on the server before retrying from the IDE.
