# Locations compartilhadas da stack da Câmara (incluídas pelos server blocks do
# camara.conf). NÃO termina em .conf de propósito: não deve ser auto-incluída
# por `include sites/*.conf` — só via `include sites/camara_locations.inc;`.
#
#   /api/*  -> camara-api (NestJS) 127.0.0.1:3011  (inclui WebSocket do chat)
#   /midia/ -> camara-api (mídia pública mascarada)
#   /       -> camara-web (Next.js) 127.0.0.1:3010

location ~ /\.(env|git|svn|ht) { deny all; return 404; }

location /api/ {
    proxy_pass http://127.0.0.1:3011;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-Host  $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto https;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        $connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location /midia/ {
    proxy_pass http://127.0.0.1:3011;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-Host  $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto https;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}

location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-Host  $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto https;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}
