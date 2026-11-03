#!/usr/bin/env bash
# One-time setup of a fresh Debian 12+/Ubuntu 24.04+ VPS for Umapastèque.
# Safe to run again (it only adds what is missing).
#
#   sudo bash setup-vps.sh <domain> <email> "<deploy public key>"
#
#   domain   e.g. umapasteque.example.com (its DNS must already point here for HTTPS)
#   email    for Let's Encrypt expiry notices
#   key      the public half of the key GitHub Actions deploys with (ssh-ed25519 AAAA…)
set -euo pipefail

DOMAIN=${1:?domain missing}
EMAIL=${2:?email missing}
DEPLOY_KEY=${3:?deploy public key missing}
HERE=$(cd "$(dirname "$0")" && pwd)
SITE=/var/www/umapasteque

[ "$(id -u)" = 0 ] || { echo "Run it with sudo." >&2; exit 1; }

echo "== Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq nginx certbot python3-certbot-nginx rsync ufw fail2ban unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades   # security updates install themselves

echo "== Deploy user (GitHub Actions logs in as 'deploy', can only write the site)"
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
grep -qxF "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys || echo "$DEPLOY_KEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys; chmod 600 /home/deploy/.ssh/authorized_keys

echo "== Site folders"
install -d -o deploy -g deploy "$SITE" "$SITE/releases"
if [ ! -e "$SITE/current" ]; then   # placeholder until the first deploy
  install -d -o deploy -g deploy "$SITE/releases/empty"
  echo "<!doctype html><title>Umapastèque</title><p>Coming soon." > "$SITE/releases/empty/index.html"
  ln -s releases/empty "$SITE/current"; chown -h deploy:deploy "$SITE/current"
fi

echo "== Nginx"
install -m 644 "$HERE/nginx-headers.conf" /etc/nginx/snippets/umapasteque-headers.conf
if [ ! -e /etc/nginx/sites-available/umapasteque ]; then   # certbot edits it later: never overwrite
  sed "s/DOMAIN/$DOMAIN/g" "$HERE/nginx-umapasteque.conf" > /etc/nginx/sites-available/umapasteque
fi
ln -sf /etc/nginx/sites-available/umapasteque /etc/nginx/sites-enabled/umapasteque
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "== Firewall: SSH, HTTP, HTTPS only"
ufw allow OpenSSH >/dev/null
ufw allow "Nginx Full" >/dev/null
ufw --force enable

echo "== SSH: keys only"
# Only once an admin key is in place, or this would lock everyone out
if compgen -G "/home/*/.ssh/authorized_keys" >/dev/null || [ -s /root/.ssh/authorized_keys ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/10-keys-only.conf
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
else
  echo "   No SSH key found for an admin user: password login left on. Add your key, then run this again." >&2
fi

echo "== HTTPS (Let's Encrypt)"
if certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --redirect -n; then
  echo "   https://$DOMAIN is ready; the certificate renews itself."
else
  echo "   HTTPS failed: check that $DOMAIN points to this server, then run this script again." >&2
fi

echo "Done. Now add the GitHub settings (deploy/README.md, step 5)."
