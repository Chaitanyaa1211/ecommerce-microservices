# ShopFlow — E-Commerce Microservices Platform

> A production-grade e-commerce backend built with microservices architecture,
> containerized with Docker, deployed on Kubernetes, and automated with a Jenkins CI/CD pipeline using Helm.

---

## 📌 Project Overview

ShopFlow is a fully functional e-commerce backend split into 6 independent microservices.
Each service has its own database, Docker container, and Kubernetes deployment.
The entire stack is automated from code push to deployment using Jenkins and Helm.

This project was built as a hands-on DevOps portfolio project — every component was set up manually, debugged, and deployed from scratch.

---

## 🏗️ Architecture

```
                    ┌─────────────────────────────────┐
  Client / Postman ─►        API Gateway :3000         │
                    │  JWT Auth · Rate Limiting · Proxy │
                    └──┬──────┬──────┬──────┬──────┬──┘
                       │      │      │      │      │
              ┌────────┘  ┌───┘  ┌───┘  ┌───┘  ┌───┘
              ▼           ▼      ▼      ▼      ▼
         User:3001  Product:3002 Cart:3003 Order:3004 Payment:3005
              │           │      │      │      │
              └───────────┴──────┴──────┴──────┘
                                 │
                          MongoDB :27017
              (userdb / productdb / cartdb / orderdb / paymentdb)
```

### Inter-Service Communication

```
Cart Service    ──► Product Service   (stock validation)
Order Service   ──► Cart Service      (fetch & clear cart)
Order Service   ──► Product Service   (stock decrement)
Payment Service ──► Order Service     (update payment status)
```

---

## 🧩 Services

| Service | Port | Responsibility |
|---------|------|----------------|
| API Gateway | 3000 | Single entry point — JWT auth, rate limiting, request routing |
| User Service | 3001 | Register, login, profile management, address book |
| Product Service | 3002 | Product catalog, categories, search, reviews, stock |
| Cart Service | 3003 | Shopping cart — add, update, remove, clear |
| Order Service | 3004 | Place orders, track status, cancellations |
| Payment Service | 3005 | Payment processing (mock gateway), refunds, history |

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js 18 |
| Framework | Express.js |
| Database | MongoDB 7 |
| ODM | Mongoose |
| Auth | JWT (jsonwebtoken) |
| Password Hashing | Bcrypt (12 rounds) |
| Containerization | Docker |
| Orchestration | Kubernetes (K3s) |
| Package Manager (K8s) | Helm |
| CI/CD | Jenkins |
| Container Registry | Docker Hub |
| API Gateway Proxy | http-proxy-middleware |
| Security | Helmet, CORS, Rate Limiting |
| Logging | Morgan |
| HTTP Client | Axios |
| Input Validation | express-validator |
| Local Dev | Docker Compose |

---

## 📁 Project Structure

```
shopflow/
├── Jenkinsfile                    ← CI/CD pipeline definition
├── docker-compose.yml             ← Local full-stack setup
│
├── api-gateway/                   ← Entry point for all requests
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js               ← Routes, proxy config, rate limiter
│       └── middleware/auth.js     ← JWT verification
│
├── user-service/
├── product-service/
├── cart-service/
├── order-service/
├── payment-service/
│   └── (each has Dockerfile, package.json, src/)
│
├── helm/
│   └── ecommerce/                 ← Umbrella Helm chart
│       ├── Chart.yaml
│       ├── values.yaml            ← All configurable values
│       └── templates/
│           ├── mongodb/           ← deployment, service, pvc
│           ├── api-gateway/       ← deployment, service, configmap
│           ├── user-service/
│           ├── product-service/
│           ├── cart-service/
│           ├── order-service/
│           ├── payment-service/
│           └── app-secrets.yml
│
└── k8s-manifest/                  ← Raw Kubernetes manifests (reference)
    ├── namespace.yml
    ├── secrets/
    └── (per-service: deployment, service, configmap)
```

---

## 🔄 CI/CD Pipeline

```
GitHub Push
    │
    ▼
Jenkins (triggered automatically)
    │
    ├── BUILD — docker build all 6 services (tag: 1.BUILD_NUMBER)
    │
    ├── PUSH — docker push to Docker Hub
    │
    ├── DEPLOY — helm upgrade --install (rolling update)
    │           only changed pods restart
    │
    └── VERIFY — kubectl get all -n ecommerce
```

**Jenkinsfile stages:**

```groovy
BUILD   → docker build -t image:1.BUILD_NUMBER .  (x6 services)
PUSH    → docker push to Docker Hub               (x6 services)
DEPLOY  → helm upgrade --install ecommerce        (Helm handles K8s)
VERIFY  → kubectl get all -n ecommerce
```

**Key pipeline features:**
- `DOCKER_BUILDKIT=0` — disables BuildKit to avoid Docker Hub attestation issues
- `BUILD_NUMBER` versioning — every build gets a unique image tag
- Helm `--install` flag — creates release if it doesn't exist, upgrades if it does
- Rolling update — old pod stays running until new pod is healthy

---

## 🚀 Running Locally

### Prerequisites

```
Docker + Docker Compose
Node.js 18+
Git
```

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Chaitanyaa1211/ecommerce-microservices.git
cd ecommerce-microservices

# 2. Start everything with Docker Compose
docker compose up --build

# 3. Verify all 7 containers are running
docker ps
```

All services start automatically. MongoDB initializes with auth enabled.

**Access:** `http://localhost:3000`

---

## ☸️ Running on Kubernetes

### Prerequisites

```
kubectl
Helm 3
A running Kubernetes cluster (K3s / Minikube / Kind)
```

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Chaitanyaa1211/ecommerce-microservices.git
cd ecommerce-microservices

# 2. Create namespace
kubectl create namespace ecommerce

# 3. Install with Helm
helm install ecommerce ./helm/ecommerce --namespace ecommerce

# 4. Verify
kubectl get pods -n ecommerce
kubectl get svc -n ecommerce

# 5. Get access URL (replace with your node IP)
curl http://<NODE-IP>:30007/health
```

### Upgrade (new image version)

```bash
helm upgrade ecommerce ./helm/ecommerce \
  --namespace ecommerce \
  --set apiGateway.image.tag=1.5 \
  --set userService.image.tag=1.5
```

### Rollback

```bash
helm history ecommerce -n ecommerce
helm rollback ecommerce 1 -n ecommerce
```

---

## 📡 API Reference

**Base URL:** `http://localhost:3000` or `http://<NODE-IP>:30007`

### User Service
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/users/register` | ❌ | Register |
| POST | `/api/users/login` | ❌ | Login, get JWT |
| GET | `/api/users/profile` | ✅ | Get profile |
| PUT | `/api/users/profile` | ✅ | Update profile |
| POST | `/api/users/addresses` | ✅ | Add address |

### Product Service
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | ❌ | List products |
| GET | `/api/products/search?q=` | ❌ | Search |
| POST | `/api/products` | 👑 Admin | Create product |
| GET | `/api/categories` | ❌ | List categories |
| POST | `/api/categories` | 👑 Admin | Create category |
| POST | `/api/products/:id/reviews` | ✅ | Add review |

### Cart Service
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cart` | ✅ | Get cart |
| POST | `/api/cart/add` | ✅ | Add item |
| PUT | `/api/cart/update` | ✅ | Update quantity |
| DELETE | `/api/cart/remove/:productId` | ✅ | Remove item |
| DELETE | `/api/cart/clear` | ✅ | Clear cart |

### Order Service
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | ✅ | Place order (from cart) |
| GET | `/api/orders` | ✅ | Order history |
| GET | `/api/orders/:id` | ✅ | Order details |
| PUT | `/api/orders/:id/cancel` | ✅ | Cancel order |

### Payment Service
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/payments/process` | ✅ | Process payment |
| GET | `/api/payments/history` | ✅ | Payment history |
| POST | `/api/payments/refund/:id` | ✅ | Refund |

### Typical User Flow

```
Register → Login (get token) → Browse products → Add to cart
→ Place order → Process payment → Track order
```

---

## 🔐 Security Features

- **JWT** — verified at Gateway, forwarded as headers to services
- **Bcrypt** — 12 rounds password hashing
- **Helmet** — security headers on every service
- **Rate Limiting** — 200 req/15min global, 20 req/15min for auth
- **Internal Token** — `x-internal-token` header for service-to-service calls
- **Soft Delete** — products are never hard deleted
- **Input Validation** — express-validator on all routes

---

## 📚 What I Learned

### DevOps
- Writing production-grade Dockerfiles with multi-layer caching
- Docker Compose for local multi-service orchestration
- Kubernetes fundamentals — Pods, Deployments, Services, ConfigMaps, Secrets, PVC
- Helm chart creation from scratch — templates, values, `{{ .Values }}` syntax
- Jenkins declarative pipelines with credentials management
- The difference between `kubectl apply` and `helm upgrade --install`
- How `KUBECONFIG` works and why it's needed in Jenkins
- Rolling updates in Kubernetes — zero downtime deployments
- Docker layer caching and how `COPY . .` order affects build speed

### Backend / Architecture
- Microservices communication patterns (sync HTTP via Axios)
- API Gateway pattern — single entry point, JWT verification once
- Database-per-service pattern
- Inter-service internal token authentication
- Soft delete vs hard delete trade-offs

### Debugging & Problem Solving
- `BuildKit` attestation manifests causing Docker Hub `400 Bad Request`
- `http-proxy-middleware` path stripping and how to fix with `pathRewrite`
- YAML indentation bugs in Kubernetes manifests
- Helm `.Values` keys cannot contain hyphens — must use camelCase
- JWT tokens carry the role at time of issue — DB role update needs re-login
- `kubectl rollout restart deployment` for forcing pod restarts when image tag doesn't change

---

## 🧗 Challenges I Faced

| Challenge | What Happened | How I Fixed It |
|-----------|---------------|----------------|
| API Gateway 404 | `http-proxy-middleware` stripped `/api/users` prefix | Added `pathRewrite: (path, req) => req.originalUrl` |
| Docker Hub 400 | BuildKit generates attestation manifests rejected by free tier | Set `DOCKER_BUILDKIT=0` |
| Push timeout | 250kbps upload + 30min Docker Hub session limit | Pushed unique layers once, subsequent pushes use `Layer already exists` |
| K8s namespace conflict | `helm --create-namespace` fails if namespace exists | `kubectl create namespace --dry-run=client \| kubectl apply -f -` |
| JWT role not updating | Token has role baked in at login time | Must re-login after DB role update |
| Helm hyphen keys | `.Values.user-service.image` breaks templating | Renamed all keys to camelCase in `values.yaml` |
| Wrong image path in templates | `{{ .Values.mongodb.image.repository }}:{{ .Values.image.tag }}` | Fixed path to `{{ .Values.mongodb.image.tag }}` |
| Pods not restarting | Same image tag = Helm sees no change | `kubectl rollout restart deployment -n ecommerce` |

---

## 🗺️ What's Next (Roadmap)

| Feature | Description |
|---------|-------------|
| **GitHub Webhook** | Trigger Jenkins automatically on `git push` |
| **Parallel builds** | Build all 6 services simultaneously in Jenkins |
| **Per-service detection** | Only build/deploy the service that changed |
| **Redis Cache** | Cache product catalog in API Gateway |
| **Razorpay / Stripe** | Replace mock payment gateway |
| **RabbitMQ** | Replace sync HTTP calls with async message queue |
| **Prometheus + Grafana** | Metrics and dashboards |
| **Jest Tests** | Unit and integration tests → add test stage to pipeline |
| **Ingress + TLS** | Replace NodePort with Nginx Ingress + Let's Encrypt |
| **EKS / GKE** | Deploy to cloud Kubernetes instead of local |

---

## 👨‍💻 Author

**Chaitanya Patil**
DevOps Engineer | RHCSA Certified | AWS Solutions Architect Associate (pursuing)
Navi Mumbai, India

- GitHub: [@Chaitanyaa1211](https://github.com/Chaitanyaa1211)
- LinkedIn: [www.linkedin.com/in/chaitanya-patil1211)

---

