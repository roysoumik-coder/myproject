# From Scratch Deployment: GitHub Actions + AWS EC2 + VPC + Security Group + Nginx + ngrok

This guide deploys the Student Management System without Docker.

Public web traffic uses ports `80` and `443`. The Node.js app runs privately on `127.0.0.1:3000` behind Nginx.

Target architecture:

```text
Developer laptop
  -> GitHub repository
  -> GitHub Actions
  -> SSH/rsync deployment
  -> AWS EC2 instance in a public subnet
  -> Node.js service on localhost:3000
  -> Nginx reverse proxy on port 80
  -> Security group exposes 80 and 443
  -> ngrok tunnels to Nginx on port 80
```

## 1. Prerequisites

- GitHub account
- AWS account
- ngrok account and authtoken
- SSH client
- Node.js 20 locally if you want to run the app before deployment

The EC2 instructions assume Ubuntu Server 24.04 LTS or 22.04 LTS.

## 2. Create GitHub Repository

Create a new GitHub repository, then push this project:

```sh
git init
git add .
git commit -m "Create student management system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/student-management-system.git
git push -u origin main
```

## 3. Create AWS VPC From Scratch

### 3.1 Create VPC

1. Open AWS Console.
2. Go to VPC.
3. Choose Create VPC.
4. Select VPC only.
5. Name: `sms-vpc`
6. IPv4 CIDR: `10.0.0.0/16`
7. Create VPC.

### 3.2 Create Public Subnet

1. Go to Subnets.
2. Choose Create subnet.
3. VPC: `sms-vpc`
4. Subnet name: `sms-public-subnet-a`
5. Availability Zone: choose one, for example `ap-south-1a`
6. IPv4 subnet CIDR: `10.0.1.0/24`
7. Create subnet.
8. Select the subnet.
9. Actions -> Edit subnet settings.
10. Enable auto-assign public IPv4 address.

### 3.3 Create Internet Gateway

1. Go to Internet gateways.
2. Choose Create internet gateway.
3. Name: `sms-igw`
4. Create.
5. Select it.
6. Actions -> Attach to VPC.
7. Choose `sms-vpc`.

### 3.4 Create Route Table

1. Go to Route tables.
2. Choose Create route table.
3. Name: `sms-public-rt`
4. VPC: `sms-vpc`
5. Create.
6. Open Routes tab.
7. Edit routes.
8. Add route:
   - Destination: `0.0.0.0/0`
   - Target: `sms-igw`
9. Open Subnet associations.
10. Edit subnet associations.
11. Select `sms-public-subnet-a`.

## 4. Create Security Group

Create a security group named `sms-ec2-sg` in `sms-vpc`.

Inbound rules:

| Type | Port | Source | Purpose |
|---|---:|---|---|
| SSH | 22 | Your public IP `/32` for setup; GitHub Actions runner source for CI/CD | Admin access and automated deployment |
| HTTP | 80 | `0.0.0.0/0` | Public web traffic through Nginx |
| HTTPS | 443 | `0.0.0.0/0` | Future TLS/HTTPS traffic |

Outbound rules:

| Type | Destination | Purpose |
|---|---|---|
| All traffic | `0.0.0.0/0` | apt updates, GitHub, and outbound ngrok tunnel |

Do not expose port `3000` in the security group. The Node app should only be reached by Nginx on the EC2 instance.

For a beginner lab, you may temporarily set SSH source to `0.0.0.0/0` while GitHub Actions deploys. This is convenient but less secure. A better production approach is to use a self-hosted runner, a VPN/bastion host, or an automated step that temporarily allows the current GitHub runner IP.

## 5. Create EC2 Key Pair

1. Go to EC2 -> Key pairs.
2. Choose Create key pair.
3. Name: `sms-key`
4. Type: RSA
5. Format: `.pem`
6. Download and protect it:

```sh
chmod 400 ~/Downloads/sms-key.pem
```

## 6. Launch EC2 Instance

1. Go to EC2 -> Instances -> Launch instances.
2. Name: `sms-app-server`
3. AMI: Ubuntu Server 24.04 LTS or 22.04 LTS.
4. Instance type: `t2.micro` or `t3.micro`.
5. Key pair: `sms-key`.
6. Network settings:
   - VPC: `sms-vpc`
   - Subnet: `sms-public-subnet-a`
   - Auto-assign public IP: Enable
   - Security group: `sms-ec2-sg`
7. Launch instance.

Copy the EC2 public IPv4 address. This guide calls it:

```text
EC2_PUBLIC_IP
```

## 7. Bootstrap EC2

Copy the bootstrap script:

```sh
scp -i ~/Downloads/sms-key.pem scripts/bootstrap_ubuntu_ec2.sh ubuntu@EC2_PUBLIC_IP:/home/ubuntu/bootstrap_ubuntu_ec2.sh
```

Run it:

```sh
ssh -i ~/Downloads/sms-key.pem ubuntu@EC2_PUBLIC_IP
sudo APP_USER=ubuntu bash /home/ubuntu/bootstrap_ubuntu_ec2.sh
```

This installs and configures:

- Node.js 20
- Nginx reverse proxy on port `80`
- ngrok
- rsync
- UFW firewall
- systemd app service
- systemd ngrok service

The application service listens internally on `PORT=3000`; Nginx exposes it publicly on `80`.

## 8. Configure ngrok on EC2

Copy your ngrok authtoken from the ngrok dashboard, then run this on EC2:

```sh
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

The included ngrok systemd service tunnels to port `80`, not port `3000`.

## 9. Add GitHub Actions Secrets

In GitHub:

1. Open repository.
2. Settings -> Secrets and variables -> Actions.
3. Add repository secrets:

| Secret | Value |
|---|---|
| `EC2_HOST` | EC2 public IPv4 address or public DNS |
| `EC2_USER` | `ubuntu` |
| `SSH_PRIVATE_KEY` | Contents of `sms-key.pem` |

GitHub CLI option:

```sh
gh secret set EC2_HOST --body "EC2_PUBLIC_IP"
gh secret set EC2_USER --body "ubuntu"
gh secret set SSH_PRIVATE_KEY < ~/Downloads/sms-key.pem
```

## 10. Deploy With GitHub Actions

Push to `main`:

```sh
git add .
git commit -m "Deploy student management system"
git push origin main
```

Open GitHub -> Actions -> Deploy student management system.

The workflow will:

1. Install Node.js.
2. Run syntax checks and tests.
3. SSH into EC2.
4. Sync files to `/opt/student-management-system`.
5. Restart the Node.js systemd service.
6. Reload Nginx.

## 11. Verify EC2 Deployment

SSH into EC2:

```sh
ssh -i ~/Downloads/sms-key.pem ubuntu@EC2_PUBLIC_IP
```

Check internal app health:

```sh
curl http://127.0.0.1:3000/health
```

Check Nginx public web port:

```sh
curl http://127.0.0.1/health
```

From your browser:

```text
http://EC2_PUBLIC_IP
```

If you later add a real domain and TLS certificate, users can access:

```text
https://your-domain.example
```

## 12. Start ngrok Tunnel

Start ngrok:

```sh
sudo systemctl start ngrok-student-management-system
sudo systemctl status ngrok-student-management-system --no-pager
```

Find the public ngrok URL:

```sh
curl http://127.0.0.1:4040/api/tunnels
```

Open the `public_url` value. It will look similar to:

```text
https://random-name.ngrok-free.app
```

That ngrok URL forwards to Nginx on port `80`, which then proxies to the private Node app on port `3000`.

## 13. Optional HTTPS on Port 443

The security group already allows port `443`. To use real HTTPS on EC2 without ngrok, attach a domain name to the EC2 public IP and install Certbot:

```sh
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.example
```

This configures Nginx for HTTPS on port `443`.

For classroom demos without a domain, ngrok already gives you an HTTPS public URL.

## 14. Useful Commands

Restart app:

```sh
sudo systemctl restart student-management-system
```

View app logs:

```sh
journalctl -u student-management-system -f
```

Check Nginx:

```sh
sudo nginx -t
sudo systemctl status nginx --no-pager
```

Restart ngrok:

```sh
sudo systemctl restart ngrok-student-management-system
```

View ngrok logs:

```sh
journalctl -u ngrok-student-management-system -f
```

## 15. Troubleshooting

If GitHub Actions cannot SSH:

- Confirm `EC2_HOST` is correct.
- Confirm `EC2_USER` is `ubuntu`.
- Confirm `SSH_PRIVATE_KEY` contains the private key content, including BEGIN and END lines.
- Confirm the security group allows SSH from the GitHub Actions runner source, not only from your laptop IP.

If the app service fails:

```sh
sudo journalctl -u student-management-system --no-pager -n 80
node --version
ls -la /opt/student-management-system
```

If Nginx fails:

```sh
sudo nginx -t
sudo journalctl -u nginx --no-pager -n 80
```

If ngrok fails:

```sh
ngrok config check
sudo journalctl -u ngrok-student-management-system --no-pager -n 80
```

## 16. Cleanup

When the demo is complete:

1. Stop or terminate EC2.
2. Delete Elastic IP if you created one.
3. Delete security group.
4. Delete route table.
5. Detach and delete internet gateway.
6. Delete subnet.
7. Delete VPC.
8. Remove GitHub Secrets if no longer used.

## References

- GitHub Actions Secrets: https://docs.github.com/en/actions/concepts/security/secrets
- AWS EC2 Security Groups: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html
- AWS Security Group Rule Editing: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/changing-security-group.html
- ngrok Linux Install: https://ngrok.com/download/linux
