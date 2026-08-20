# SAFE SOLUTIONS — Vercel Deployment & Custom Domain Guide

## 1. Quick Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **"Add New..."** $\to$ **"Project"**.
3. Import your GitHub repository:
   `https://github.com/baransag/SAFE-SOLUTIONS-fleet-smart-attendance`
4. In the Project Configuration:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (Default)
   - **Build Command**: `npm run vercel-build`
5. **Environment Variables**:
   Add the following variables in Vercel Project Settings:
   - `DATABASE_URL`: Your hosted PostgreSQL connection string (from Neon.tech, Supabase, Railway, or Aiven)
   - `JWT_SECRET`: `safe_solutions_enterprise_jwt_super_secret_key_2026_change_in_prod`
   - `JWT_EXPIRES_IN`: `7d`
   - `NODE_ENV`: `production`
   - `API_PREFIX`: `/api/v1`
6. Click **"Deploy"**.

---

## 2. Custom Domain Configuration on Vercel

Once deployed, you can assign your custom domain (e.g. `api.safesolutions.com.pk` or `safesolutions.com.pk`):

### Step A: Add Domain in Vercel
1. In your Vercel Dashboard, go to your project $\to$ **Settings** $\to$ **Domains**.
2. Type your domain name (e.g. `api.yourcompany.com` or `yourcompany.com`) and click **Add**.

### Step B: Configure DNS Records at your Domain Registrar (Namecheap, GoDaddy, Cloudflare, etc.)

#### For Apex Domain (`yourdomain.com`):
| Type | Name | Value | TTL |
|---|---|---|---|
| **A** | `@` | `76.76.21.21` | Auto / 60s |

#### For Subdomain (e.g., `api.yourdomain.com`):
| Type | Name | Value | TTL |
|---|---|---|---|
| **CNAME** | `api` | `cname.vercel-dns.com.` | Auto / 60s |

### Step C: SSL Certificate
Vercel automatically provisions and renews a free **Let's Encrypt SSL/TLS Certificate** once DNS propagation is verified.

---

## 3. Recommended Cloud PostgreSQL Providers (Free / Production Tier)
Because Vercel is serverless, your database must be hosted on a cloud PostgreSQL instance:
1. **Neon PostgreSQL** (Recommended - serverless pooling): [neon.tech](https://neon.tech)
2. **Supabase PostgreSQL**: [supabase.com](https://supabase.com)
3. **Railway PostgreSQL**: [railway.app](https://railway.app)
4. **Aiven PostgreSQL**: [aiven.io](https://aiven.io)
