SELECT 'CREATE DATABASE transport_abt OWNER transport_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'transport_abt')\gexec

SELECT 'CREATE DATABASE transport_abt_test OWNER transport_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'transport_abt_test')\gexec
