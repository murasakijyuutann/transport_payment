SELECT 'CREATE DATABASE transport_abt OWNER transport_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'transport_abt')\gexec
