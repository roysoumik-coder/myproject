# Student Management System

A no-Docker Node.js student management system for DevSecOps practice. The app includes a web UI, student add/delete workflow, validation, JSON-file persistence, a health endpoint, tests, GitHub Actions, and an AWS EC2 deployment path using Nginx and ngrok.

## Features

- Add student name, email, course, year, and status
- Delete student records
- Dashboard counts for total, active, and course coverage
- `/health` endpoint for deployment checks
- `/api/students` JSON endpoint
- No Docker, no database server, and no external Node dependencies

## Local Run

```sh
npm ci
npm test
npm start
```

Open `http://localhost:3000`.

If `npm` is not installed locally but Node.js is, the app can still run:

```sh
node index.js
```

## Project Structure

```text
.
├── index.js
├── package.json
├── test/
│   └── student-management.test.js
├── scripts/
│   ├── bootstrap_ubuntu_ec2.sh
│   └── restart_on_ec2.sh
├── .github/workflows/
│   ├── codeql.yml
│   └── deploy.yml
└── docs/
    └── deployment-aws-github-ngrok.md
```

## Deployment

Use [docs/deployment-aws-github-ngrok.md](docs/deployment-aws-github-ngrok.md) for the complete from-scratch guide:

1. Create GitHub repository.
2. Create AWS VPC, subnet, route table, internet gateway, security group, key pair, and EC2 instance.
3. Bootstrap the EC2 instance with Node.js, Nginx, systemd, and ngrok.
4. Add GitHub Actions secrets.
5. Push to `main` and let GitHub Actions deploy.
6. Expose only ports `80` and `443` in AWS. The Node app stays private on localhost `3000`.
7. Start ngrok and use the public ngrok HTTPS URL as the live app URL.

## GitHub Actions Secrets

Required:

- `EC2_HOST`: EC2 public IPv4 address or public DNS name
- `EC2_USER`: usually `ubuntu` for Ubuntu AMIs
- `SSH_PRIVATE_KEY`: private key that can SSH into the EC2 instance

Optional:

- `NGROK_AUTHTOKEN`: not used by the workflow by default. Configure ngrok once on EC2 instead.

## Security Notes

- Keep SSH open only to your IP address in the AWS security group.
- Expose HTTP `80` and HTTPS `443`; do not expose Node.js port `3000`.
- Do not commit `.pem`, `.env`, ngrok tokens, or real student data.
- The app stores demo records in `data/students.json` on the server.
- GitHub Actions runs syntax checks and tests before deployment.
- CodeQL runs separately for JavaScript security scanning.
# test deployment
# redeploy
