# 📱 QR Code Feature - User Guide

## Overview
The QR Code feature allows anyone to quickly report equipment issues by simply scanning a QR code attached to the equipment. No login required!

---

## 🎯 How It Works

### For Maintenance Teams (Admins/Technicians)

1. **View Equipment Details**
   - Go to Equipment → Click on any equipment
   - You'll see a QR Code on the right side

2. **Download QR Code**
   - Click "Download" to save as PNG image
   - Print and attach to physical equipment

3. **Print QR Code**
   - Click "Print" for a formatted printable version
   - Includes equipment name and "Scan to report issue" text
   - Ready to laminate and attach to equipment

### For End Users (Anyone)

1. **Scan QR Code**
   - Use phone camera or QR scanner app
   - Point at QR code on equipment
   - Tap the notification to open link

2. **Report Issue**
   - Fill in the form:
     - What's the problem? (required)
     - Additional details (optional)
     - How urgent? (Low/Medium/High/Critical)
     - Your name (required)
     - Your email (optional - for updates)
   
3. **Submit**
   - Issue is automatically created as a Work Order
   - Maintenance team is notified
   - You see success confirmation

---

## 🏗️ Setup Instructions

### 1. Install New Dependencies

After updating to this version, run:

```bash
npm install
```

This installs:
- `qrcode` - For generating QR codes
- `html5-qrcode` - For scanning (future feature)

### 2. Update Supabase Policies (IMPORTANT!)

The report feature needs public access to create work orders. Run this SQL in Supabase:

```sql
-- Allow public (unauthenticated) users to create work orders
CREATE POLICY "Anyone can create work orders" ON work_orders
  FOR INSERT 
  WITH CHECK (true);

-- Allow public users to read equipment info
-- (This should already exist, but verify)
CREATE POLICY "Everyone can view equipment" ON equipment
  FOR SELECT USING (true);
```

### 3. Test the Feature

1. Go to any equipment detail page
2. Download the QR code
3. Open it on your phone
4. Scan the QR code
5. Fill in the report form
6. Check Work Orders to see the new issue

---

## 📋 Usage Examples

### Example 1: Production Machine
```
Equipment: CNC Machine #3
Location: Production Hall A
QR Code: Printed and laminated on machine door

Worker scans → Reports "Strange grinding noise"
→ Work Order created automatically
→ Maintenance team receives notification
```

### Example 2: Office Equipment
```
Equipment: Printer - 2nd Floor
Location: Office Building - Floor 2
QR Code: Sticker on printer side

Employee scans → Reports "Paper jam error"
→ IT team sees work order
→ Issue resolved same day
```

### Example 3: Critical Equipment
```
Equipment: Main Generator
Location: Power Room
QR Code: Large laminated sign

Operator scans → Reports "Overheating alarm" 
Priority: CRITICAL
→ Emergency work order created
→ On-call technician notified immediately
```

---

## 🎨 QR Code Best Practices

### Printing
- **Size:** Minimum 2x2 inches (5x5 cm) for reliable scanning
- **Material:** Laminate for durability
- **Placement:** Eye level, well-lit area, easily accessible

### Information to Include
The printout includes:
- Equipment name
- QR code
- "Scan to report issue" text

### Mounting
- Use strong adhesive or magnetic backing
- Clean surface before applying
- Avoid areas that get dirty or wet
- Keep away from heat sources

---

## 🔒 Security Notes

### What's Public
- Report form (no login needed)
- Equipment basic info (name, serial, location)
- Ability to create work orders

### What's Protected
- Equipment editing
- Work order management
- User data
- Other equipment details

### Privacy
- Reporter name and email are stored in work order description
- No personal data is tracked
- Anonymous reporting possible (just needs a name)

---

## 🚀 Advanced Features (Future)

### Planned Enhancements
- [ ] QR Scanner built into app
- [ ] Photo upload with issue report
- [ ] SMS notifications for reporter
- [ ] Equipment manuals via QR code
- [ ] Maintenance history on scan
- [ ] Multiple language support

---

## 🐛 Troubleshooting

### QR Code Won't Scan
- Ensure good lighting
- Clean the QR code surface
- Try different QR scanner apps
- Check if code is damaged

### Report Form Errors
- Check internet connection
- Verify equipment still exists
- Ensure name field is filled

### Work Orders Not Creating
- Check Supabase policies (see Setup #2)
- Verify network connection
- Check browser console for errors

---

## 💡 Tips & Tricks

1. **Label Equipment**
   - Add equipment ID to QR code printout
   - Include emergency contact number

2. **Strategic Placement**
   - Put QR codes where issues typically occur
   - Multiple QR codes for large equipment

3. **Training**
   - Show staff how to scan QR codes
   - Explain what information to include
   - Emphasize urgency levels

4. **Monitoring**
   - Check work orders from QR scans weekly
   - Adjust QR code placement based on usage
   - Update equipment info regularly

---

## 📞 Support

For questions or issues with the QR code feature:
1. Check this documentation
2. Review Supabase policies
3. Test with different devices
4. Contact system administrator

---

**Happy Scanning! 📱✨**
