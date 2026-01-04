# User Roles & Permissions Guide

## Setup Instructions

1. **Run Migration in Supabase SQL Editor:**
   - Go to Supabase Dashboard → SQL Editor
   - Open `migration-user-roles.sql`
   - Execute it
   - Your first user will automatically become Admin

2. **Access User Management:**
   - Only Admins see "Users" in sidebar
   - Navigate to Users page
   - Invite new users with roles

## Role Hierarchy

### 🟣 Admin (Full Access)
**Can do everything:**
- ✅ Manage all users (invite, edit roles, delete)
- ✅ Create/Edit/Delete Equipment
- ✅ Create/Edit/Delete Work Orders
- ✅ Create/Edit/Delete Maintenance Schedules
- ✅ Create/Edit/Delete Checklist Templates
- ✅ Create/Edit/Delete Procedure Templates
- ✅ Create/Edit/Delete Locations
- ✅ Complete maintenance tasks
- ✅ View all reports

### 🔵 Manager (Management Access)
**Can manage operations:**
- ❌ Cannot manage users
- ✅ Create/Edit Equipment
- ✅ Create/Edit/Delete Work Orders
- ✅ Create/Edit Maintenance Schedules
- ✅ Create/Edit Checklist Templates
- ✅ Create/Edit Procedure Templates
- ✅ Create/Edit Locations
- ✅ Complete maintenance tasks
- ✅ View all reports

### 🟢 Technician (Operational Access)
**Can execute tasks:**
- ❌ Cannot manage users
- ❌ Cannot create/edit Equipment
- ✅ View Equipment
- ✅ Create/Update assigned Work Orders
- ❌ Cannot delete Work Orders
- ✅ View Maintenance Schedules
- ✅ Complete maintenance tasks
- ✅ View Checklist/Procedure Templates
- ❌ Cannot edit Templates
- ✅ View Locations

## Permission Matrix

| Feature | Admin | Manager | Technician |
|---------|-------|---------|------------|
| **User Management** |
| View Users | ✅ | ❌ | ❌ |
| Invite Users | ✅ | ❌ | ❌ |
| Edit User Roles | ✅ | ❌ | ❌ |
| Delete Users | ✅ | ❌ | ❌ |
| **Equipment** |
| View | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ |
| Edit | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| Import Excel | ✅ | ✅ | ❌ |
| **Work Orders** |
| View | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ✅ |
| Edit Own | ✅ | ✅ | ✅ |
| Edit Any | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ |
| **Maintenance Schedules** |
| View | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ |
| Edit | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| Complete Tasks | ✅ | ✅ | ✅ |
| **Templates (Checklists/Procedures)** |
| View | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ |
| Edit | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| **Locations** |
| View | ✅ | ✅ | ✅ |
| Create | ✅ | ✅ | ❌ |
| Edit | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |

## How to Invite Users

1. **Admin logs in** → Goes to "Users" page
2. Click **"Invite User"** button
3. Fill in:
   - Email address
   - Select role (Technician/Manager/Admin)
4. Click **"Create User"**
5. **IMPORTANT:** Copy the generated password and share it securely with the new user
6. User can login with email and temporary password
7. User should change password in Settings after first login

**Note:** Passwords are randomly generated (12 characters with letters, numbers, and symbols).

## Managing Existing Users

### Change User Role:
1. Go to Users page
2. Click **Edit** icon (✏️) next to user
3. Select new role from dropdown
4. Changes apply immediately

### Delete User:
1. Go to Users page
2. Click **Delete** icon (🗑️) next to user
3. Confirm deletion
4. ⚠️ **Cannot delete yourself**
5. **Note:** User will be marked as deleted (not fully removed from database)

## Security Features

- ✅ Row Level Security (RLS) enforced on all tables
- ✅ Permissions checked at database level
- ✅ Cannot escalate own privileges
- ✅ Admin cannot delete themselves
- ✅ First user automatically becomes Admin

## Best Practices

1. **Keep at least 2 Admins** - in case one is unavailable
2. **Use Technician role** for field workers
3. **Use Manager role** for supervisors
4. **Review user list regularly** and remove inactive users
5. **Don't share accounts** - each person gets their own

## Troubleshooting

**Q: I can't see the Users menu**
A: Only Admins can access User Management

**Q: I accidentally deleted the only Admin**
A: Run this SQL in Supabase:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

**Q: User invitation failed**
A: Check that email doesn't already exist in the system

**Q: Technician can't complete maintenance**
A: This is allowed - technicians CAN complete tasks, just can't create/edit schedules
