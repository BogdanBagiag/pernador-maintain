# Pernador Maintain - Project Plan

## 🎯 Project Overview
**Pernador Maintain** is a comprehensive maintenance management application designed to help companies track equipment, manage work orders, schedule preventive maintenance, and streamline maintenance operations.

## 📱 Platform
- **Primary:** Web Application (Responsive)
- **Mobile:** Mobile-responsive design (works on phones/tablets)
- **Future:** React Native mobile apps (iOS/Android)

## 🛠 Tech Stack

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** TailwindCSS + shadcn/ui components
- **State Management:** React Context API + React Query
- **Forms:** React Hook Form + Zod validation
- **Routing:** React Router v6
- **Icons:** Lucide React
- **Date handling:** date-fns

### Backend
- **BaaS:** Supabase
  - PostgreSQL Database
  - Authentication (Email/Password)
  - Row Level Security (RLS)
  - Storage (for photos/attachments)
  - Real-time subscriptions
  - Auto-generated REST API

### Deployment
- **Frontend:** Vercel (free tier)
- **Backend:** Supabase (free tier - 500MB DB, 1GB storage)

## 📊 Database Schema

### Tables

#### 1. `profiles` (extends Supabase auth.users)
```sql
- id (uuid, PK, FK to auth.users)
- email (text)
- full_name (text)
- role (enum: 'admin', 'technician', 'requester')
- avatar_url (text)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 2. `equipment`
```sql
- id (uuid, PK)
- name (text)
- description (text)
- serial_number (text, unique)
- manufacturer (text)
- model (text)
- location (text)
- purchase_date (date)
- status (enum: 'operational', 'maintenance', 'broken', 'retired')
- image_url (text)
- qr_code (text)
- created_by (uuid, FK to profiles)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 3. `work_orders`
```sql
- id (uuid, PK)
- title (text)
- description (text)
- equipment_id (uuid, FK to equipment)
- priority (enum: 'low', 'medium', 'high', 'critical')
- status (enum: 'open', 'in_progress', 'on_hold', 'completed', 'cancelled')
- type (enum: 'corrective', 'preventive', 'inspection')
- created_by (uuid, FK to profiles)
- assigned_to (uuid, FK to profiles, nullable)
- scheduled_date (timestamp)
- completed_date (timestamp, nullable)
- estimated_hours (decimal)
- actual_hours (decimal, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 4. `work_order_attachments`
```sql
- id (uuid, PK)
- work_order_id (uuid, FK to work_orders)
- file_url (text)
- file_name (text)
- file_type (text)
- uploaded_by (uuid, FK to profiles)
- created_at (timestamp)
```

#### 5. `maintenance_schedules`
```sql
- id (uuid, PK)
- equipment_id (uuid, FK to equipment)
- title (text)
- description (text)
- frequency (enum: 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')
- interval_value (integer) -- e.g., every 2 weeks
- next_due_date (date)
- assigned_to (uuid, FK to profiles, nullable)
- is_active (boolean)
- created_by (uuid, FK to profiles)
- created_at (timestamp)
- updated_at (timestamp)
```

#### 6. `work_order_comments`
```sql
- id (uuid, PK)
- work_order_id (uuid, FK to work_orders)
- user_id (uuid, FK to profiles)
- comment (text)
- created_at (timestamp)
- updated_at (timestamp)
```

## 🎨 User Interface - Pages

### Public Pages
1. **Landing Page** (`/`) - Marketing page with features
2. **Login** (`/login`) - User authentication
3. **Register** (`/register`) - New user signup

### Authenticated Pages
4. **Dashboard** (`/dashboard`) - Overview with KPIs and stats
5. **Equipment List** (`/equipment`) - All equipment with filters
6. **Equipment Detail** (`/equipment/:id`) - Single equipment view + history
7. **Add/Edit Equipment** (`/equipment/new`, `/equipment/:id/edit`)
8. **Work Orders List** (`/work-orders`) - All work orders with filters
9. **Work Order Detail** (`/work-orders/:id`) - Single work order view
10. **Create/Edit Work Order** (`/work-orders/new`, `/work-orders/:id/edit`)
11. **Maintenance Schedules** (`/schedules`) - Preventive maintenance calendar
12. **Reports** (`/reports`) - Basic analytics and reports
13. **Profile Settings** (`/settings`) - User profile and preferences
14. **User Management** (`/users`) - Admin only: manage team members

## 🔐 User Roles & Permissions

### Admin
- Full access to everything
- Manage users
- Create/edit/delete equipment
- Create/assign/complete work orders
- View all reports

### Technician
- View all equipment
- View assigned work orders
- Update work order status
- Add comments and photos
- Complete assigned tasks

### Requester
- View equipment (read-only)
- Create work order requests
- View own requests
- Add comments to own requests

## 🚀 Implementation Phases

### Phase 1: Foundation (Day 1-2)
- ✅ Project setup (Vite + React + TailwindCSS)
- ✅ Supabase setup and database schema
- ✅ Authentication system (login/register)
- ✅ Basic routing and layout
- ✅ Protected routes

### Phase 2: Core Features (Day 3-4)
- ✅ Equipment Registry (CRUD)
- ✅ Equipment list with search/filter
- ✅ Work Order Management (CRUD)
- ✅ Work order assignment

### Phase 3: Operations (Day 5-6)
- ✅ Status tracking and updates
- ✅ Photo/file upload functionality
- ✅ Comments system
- ✅ User profiles

### Phase 4: Automation (Day 7-8)
- ✅ Preventive maintenance scheduling
- ✅ Automatic work order generation
- ✅ Notifications (email)

### Phase 5: Reporting (Day 9-10)
- ✅ Dashboard with KPIs
- ✅ Basic reports (completion rate, MTTR)
- ✅ Charts and visualizations

### Phase 6: Polish (Day 11-12)
- ✅ Mobile responsive design
- ✅ Performance optimization
- ✅ User testing and bug fixes
- ✅ Deployment to Vercel

## 📈 Success Metrics

### MVP Success Criteria
- [ ] User can register and login
- [ ] User can add/view/edit equipment
- [ ] User can create work orders
- [ ] User can assign work orders to technicians
- [ ] User can update work order status
- [ ] User can upload photos to work orders
- [ ] User can schedule preventive maintenance
- [ ] Dashboard shows basic statistics
- [ ] Application is mobile-responsive

## 🔮 Future Enhancements (Post-MVP)

### Phase 7: Advanced Features
- QR code generation and scanning
- Advanced filtering and search
- Bulk operations
- Export to PDF/Excel
- Email notifications
- Mobile push notifications

### Phase 8: Native Mobile Apps
- React Native iOS app
- React Native Android app
- Offline mode
- Camera integration
- GPS location tracking

### Phase 9: Enterprise Features
- Multi-site management
- Parts inventory management
- Vendor management
- Advanced analytics
- Custom reports builder
- IoT sensor integration

## 💰 Cost Estimate (Free Tier)

### Development Phase
- **Development:** Free (DIY)
- **Supabase:** Free (up to 500MB DB, 1GB storage, 50K monthly active users)
- **Vercel:** Free (100GB bandwidth/month)
- **Domain:** ~$12/year (optional)

### Production (Small Team - 10 users)
- **Supabase:** Free tier sufficient
- **Vercel:** Free tier sufficient
- **Total:** $0-12/year (just domain if wanted)

### Scaling (100+ users)
- **Supabase Pro:** $25/month
- **Vercel Pro:** $20/month (if needed)
- **Total:** ~$45-50/month

## 📚 Documentation Structure
- README.md - Getting started guide
- API.md - Supabase API documentation
- DEPLOYMENT.md - Deployment instructions
- USER_GUIDE.md - End-user documentation
- DEVELOPMENT.md - Developer setup guide

## 🎯 Next Steps
1. Generate project structure
2. Setup Supabase project
3. Create database schema
4. Build authentication system
5. Implement equipment registry
6. Deploy MVP to Vercel
