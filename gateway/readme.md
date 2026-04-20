### How to add cert ssl for new domain with certbot
- exec to container certbot
- run this cmd

certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  -d grafana.sauciu.io.vn