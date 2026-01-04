# 🔧 Pernador Maintain

**A modern equipment maintenance management system**

Pernador Maintain is a comprehensive web application designed to help companies track equipment, manage work orders, schedule preventive maintenance, and streamline maintenance operations.

---

## 🚀 Features

### ✅ MUST-HAVE Features (MVP)
1. ✅ **Work Order Management** - Create, assign, and track work orders
2. ✅ **Equipment Registry** - Complete database of all equipment
3. ✅ **Asset/Equipment Management** - Add, edit, view equipment details
4. ✅ **Status Tracking** - Real-time work order status updates
5. ✅ **Photo Upload** - Attach images to work orders
6. ✅ **Preventive Maintenance Scheduling** - Automate recurring maintenance
7. ✅ **User Permissions** - Admin, Technician, Requester roles
8. ✅ **Basic Reporting** - Dashboard with KPIs
9. ✅ **Mobile Responsive** - Works on all devices

### 🔮 Future Features
- QR code generation and scanning
- Advanced analytics and reporting
- Email notifications
- Parts inventory management
- Native mobile apps (iOS/Android)
- Multi-site management
- IoT sensor integration

---

## 🛠 Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** TailwindCSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **State Management:** React Context API + React Query
- **Routing:** React Router v6
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React
- **Deployment:** Vercel

---

## 📋 Prerequisites

Before you begin, ensure you have:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Supabase account** - [Sign up](https://supabase.com)
- **Git** (optional)

---

## 🚀 Getting Started

### 1. Clone or Download the Project

```bash
# If using Git
git clone <your-repo-url>
cd pernador-maintain

# Or download and extract the ZIP file
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Setup Supabase

#### A. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name:** Pernador Maintain
   - **Database Password:** (choose a strong password)
   - **Region:** (select closest to you)
4. Click "Create new project" and wait ~2 minutes

#### B. Run Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase-schema.sql`
4. Paste into the SQL Editor
5. Click "Run" or press `Ctrl + Enter`
6. Wait for "Success. No rows returned" message

#### C. Setup Storage Bucket (for photos)

1. Go to **Storage** in Supabase dashboard
2. Click "Create a new bucket"
3. Name it: `work-order-attachments`
4. Make it **Public**
5. Click "Create bucket"

#### D. Get Your Supabase Credentials

1. Go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Create .env file
touch .env
```

Add your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **Important:** Never commit `.env` to Git!

### 5. Run the Application

```bash
npm run dev
# or
yarn dev
```

The app will open at `http://localhost:3000` 🎉

---

## 👤 First User Setup

### Create Your First Admin Account

1. Go to `http://localhost:3000`
2. Click "Sign up"
3. Fill in your details:
   - **Full Name:** Your Name
   - **Email:** your@email.com
   - **Password:** (min 6 characters)
4. Click "Create account"

### Make Yourself an Admin

After registration, you need to manually set your role to admin:

1. Go to Supabase dashboard
2. Navigate to **Table Editor** → **profiles**
3. Find your user (by email)
4. Click on the `role` field
5. Change from `requester` to `admin`
6. Save

Now refresh the app - you have full admin access! ✨

---

## 📱 Usage Guide

### Dashboard
- View overview statistics
- See recent activity
- Quick access to all sections

### Equipment Management
1. Click "Equipment" in sidebar
2. Click "Add Equipment" button
3. Fill in equipment details:
   - Name, Description
   - Serial Number, Manufacturer, Model
   - Location
   - Purchase Date
   - Status (Operational/Maintenance/Broken/Retired)
4. Save

### Work Orders
1. Click "Work Orders" in sidebar
2. Click "Create Work Order"
3. Fill in:
   - Title, Description
   - Select Equipment
   - Priority (Low/Medium/High/Critical)
   - Type (Corrective/Preventive/Inspection)
   - Assign to Technician
   - Schedule Date
4. Create Work Order

### Preventive Maintenance
1. Click "Schedules" in sidebar
2. Click "Add Schedule"
3. Configure:
   - Select Equipment
   - Title, Description
   - Frequency (Daily/Weekly/Monthly/Quarterly/Yearly)
   - Next Due Date
   - Assign to Technician
4. Save Schedule

---

## 🔐 User Roles

### Admin
- Full access to everything
- Manage users, equipment, work orders
- View all reports
- Delete records

### Technician
- View all equipment
- Manage assigned work orders
- Update work order status
- Upload photos and add comments

### Requester
- View equipment (read-only)
- Create work order requests
- View own requests
- Add comments to own requests

---

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click "Deploy"

Your app will be live in ~2 minutes! 🎉

---

## 📁 Project Structure

```
pernador-maintain/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── Layout.jsx
│   │   └── LoadingSpinner.jsx
│   ├── contexts/        # React contexts
│   │   └── AuthContext.jsx
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities and configurations
│   │   └── supabase.js
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── EquipmentList.jsx
│   │   ├── EquipmentDetail.jsx
│   │   ├── EquipmentForm.jsx
│   │   ├── WorkOrderList.jsx
│   │   ├── WorkOrderDetail.jsx
│   │   ├── WorkOrderForm.jsx
│   │   ├── MaintenanceSchedules.jsx
│   │   ├── Reports.jsx
│   │   ├── Settings.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── LandingPage.jsx
│   ├── utils/           # Helper functions
│   ├── App.jsx          # Main App component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── .env                 # Environment variables (not committed)
├── .gitignore
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── supabase-schema.sql  # Database schema
├── PROJECT_PLAN.md      # Detailed project plan
└── README.md            # This file
```

---

## 🐛 Troubleshooting

### "Supabase client not initialized"
- Check your `.env` file has correct credentials
- Make sure variable names start with `VITE_`
- Restart the dev server after changing `.env`

### "Cannot find profiles table"
- Run the `supabase-schema.sql` in Supabase SQL Editor
- Check all migrations completed successfully

### "Permission denied" errors
- Check Row Level Security (RLS) policies in Supabase
- Verify your user role in the profiles table

### Build errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

---

## 🛣 Roadmap

### Phase 1: MVP ✅ (Current)
- [x] Authentication system
- [x] Equipment management
- [x] Work order management
- [x] Basic dashboard
- [ ] Preventive maintenance (In Progress)
- [ ] Photo uploads (In Progress)
- [ ] Reports (In Progress)

### Phase 2: Enhancement
- [ ] QR code generation
- [ ] Advanced filtering
- [ ] Email notifications
- [ ] Bulk operations
- [ ] Export to PDF/Excel

### Phase 3: Mobile Apps
- [ ] React Native iOS app
- [ ] React Native Android app
- [ ] Offline mode
- [ ] Push notifications

### Phase 4: Enterprise
- [ ] Multi-site management
- [ ] Parts inventory
- [ ] Vendor management
- [ ] IoT integration
- [ ] Advanced analytics

---

## 📝 License

MIT License - feel free to use this project for personal or commercial use.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📧 Support

For questions or issues:
- Create an issue in GitHub
- Email: support@pernador.com (if applicable)

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Supabase](https://supabase.com/)
- [TailwindCSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

---

**Made with ❤️ for better maintenance management**
