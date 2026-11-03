# Hosting on a VPS

How to move the site from GitHub Pages to a VPS of its own (Nginx, HTTPS by
Let's Encrypt, deployed by GitHub Actions on every merge to `main`).
GitHub Pages keeps running until the last step, so the switch can be tested first.

| File | What it is |
|---|---|
| `setup-vps.sh` | one-time server setup: packages, `deploy` user, firewall, Nginx, HTTPS |
| `nginx-umapasteque.conf` | the Nginx site (caching, hidden files blocked) |
| `nginx-headers.conf` | security headers, including the Content Security Policy |
| `../.github/workflows/deploy-vps.yml` | the deploy, skipped until the VPS is configured |

Below, `umapasteque.example.com` stands for the real domain and `<vps-ip>` for the server's address.

## 1. The server

Any small VPS is enough (static files only). Pick **Debian 12** (or newer) or
**Ubuntu 24.04** and add your own SSH public key when ordering, so you log in
with a key from the start.

## 2. The domain

At the registrar's DNS zone, add:

| Type | Name | Value |
|---|---|---|
| `A` | `umapasteque` (or `@` for the bare domain) | `<vps-ip>` |
| `AAAA` | same | the VPS IPv6, if it has one |

Check before going on: `dig +short umapasteque.example.com` must print `<vps-ip>`
(it can take from a few minutes to an hour).

## 3. The deploy key

On your own computer, make a key used only by GitHub Actions:

```sh
ssh-keygen -t ed25519 -N "" -C "umapasteque-deploy" -f umapasteque-deploy
```

This gives `umapasteque-deploy` (private, goes to GitHub, step 5) and
`umapasteque-deploy.pub` (public, goes to the server, step 4). Keep the private
key in your password manager, then delete both files.

## 4. Server setup

```sh
scp -r deploy <user>@<vps-ip>:
ssh <user>@<vps-ip>
sudo bash deploy/setup-vps.sh umapasteque.example.com you@example.com "$(cat umapasteque-deploy.pub)"
```

(`<user>` is the account the VPS came with, often `debian` or `ubuntu`. Paste
the public key's content in place of the `$(cat …)` part if the file is not on
the server.)

The script:
- installs Nginx, Certbot, rsync, the firewall (only SSH, HTTP and HTTPS open), fail2ban and automatic security updates;
- creates the `deploy` user, which can only write `/var/www/umapasteque`;
- turns off password logins over SSH (only once an admin key is in place);
- sets up the site and its HTTPS certificate, renewed automatically.

It can be run again safely, e.g. if HTTPS failed because the DNS was not ready yet.
`https://umapasteque.example.com` then shows "Coming soon".

## 5. GitHub settings

Repository → **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Variable | `VPS_HOST` | `umapasteque.example.com` |
| Variable | `VPS_PORT` | only if SSH is not on port 22 |
| Secret | `VPS_SSH_KEY` | content of the private key `umapasteque-deploy` |
| Secret | `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 umapasteque.example.com` |

## 6. First deploy

**Actions → Deploy site to the VPS → Run workflow**. Then open the site and the
admin page: cards, pictures, filters, rating grid. The GitHub token has to be
entered again on the new address (it is kept per site, in the browser).

From now on, every merge to `main` deploys to both GitHub Pages and the VPS.
Each deploy is uploaded to its own folder and switched to at once, so visitors
never see half a site; the last 5 are kept on the server.

To go back to an older release, on the server:

```sh
ls -t /var/www/umapasteque/releases/          # newest first
sudo -u deploy ln -sfn releases/<commit> /var/www/umapasteque/current
```

## 7. Switch off GitHub Pages

Once the VPS has worked for a while: repository **Settings → Pages → Source:
None**, delete `.github/workflows/pages.yml`, and update the link in the main README.

## Later: more tools on the same server

Each tool gets its own subdomain (`tool.example.com`), folder
(`/var/www/<tool>`) and Nginx site, made the same way. Separate subdomains
matter: what a page keeps in the browser (like the admin page's GitHub token)
is shared by everything on the same address.
