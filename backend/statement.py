
from fpdf import FPDF
from datetime import datetime
import os

class StatementPDF(FPDF):
    def __init__(self, user, wallet, transactions, title="Greenify Statement"):
        super().__init__()
        self.user = user
        self.wallet = wallet
        self.transactions = transactions
        self.title_text = title
        self.logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "brand-logo-cropped.png")

    def header(self):
        # Logo
        if os.path.exists(self.logo_path):
            self.image(self.logo_path, 10, 8, 20)
            self.set_font('helvetica', 'B', 20)
            self.cell(80)
            self.cell(30, 10, self.title_text, border=0, align='C')
            self.ln(25)
        else:
            self.set_font('helvetica', 'B', 20)
            self.cell(80)
            self.cell(30, 10, self.title_text, border=0, align='C')
            self.ln(20)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', align='C')

    def chapter_body(self):
        # User Details
        self.set_font('helvetica', 'B', 12)
        self.cell(0, 10, f"Statement for: {self.user.get('name', 'User')}", ln=True)
        self.set_font('helvetica', '', 10)
        self.cell(0, 6, f"Email: {self.user.get('email', '-')}", ln=True)
        
        created_at = self.user.get('createdAt', 'N/A')
        if 'T' in created_at:
            created_at = created_at.split('T')[0]
        self.cell(0, 6, f"Account Created: {created_at}", ln=True)
        
        balance = self.wallet.get('balance', 0)
        self.cell(0, 6, f"Current Balance: {balance} Points", ln=True)
        self.cell(0, 6, f"Green Score: {self.user.get('greenScore', '-')}", ln=True)
        self.ln(10)

        # Transactions
        self.set_font('helvetica', 'B', 12)
        self.cell(0, 10, "Transaction History", ln=True)
        self.set_font('helvetica', 'B', 10)
        
        # Table Header
        col_widths = [40, 90, 30, 30] # Date, Description, Type, Amount
        headers = ["Date", "Description", "Type", "Amount"]
        
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 8, h, border=1)
        self.ln()
        
        # Table Body
        self.set_font('helvetica', '', 9)
        for tx in self.transactions:
            date = str(tx.get('timestamp', tx.get('date', 'N/A')))
            if 'T' in date:
                date = date.split('T')[0]
            
            desc = str(tx.get('description', '-'))
            # Sanitize for Latin-1
            desc = desc.encode('latin-1', 'replace').decode('latin-1')
            
            # Truncate desc if too long
            if len(desc) > 35:
                desc = desc[:32] + "..."
                
            type_Str = str(tx.get('type', 'TX'))
            amount = str(tx.get('amount', 0))
            
            self.cell(col_widths[0], 8, date, border=1)
            self.cell(col_widths[1], 8, desc, border=1)
            self.cell(col_widths[2], 8, type_Str, border=1)
            self.cell(col_widths[3], 8, amount, border=1)
            self.ln()
            
        # End
        self.ln(10)
        self.set_font('helvetica', 'I', 8)
        self.cell(0, 10, "* This statement includes all recorded activities except login/logout events.", ln=True)

def generate_statement_pdf(user, wallet, transactions):
    pdf = StatementPDF(user, wallet, transactions, title="Greenify Statement")
    pdf.add_page()
    pdf.chapter_body()
    return pdf.output()  # Returns bytes

def generate_invoice_pdf(user, transaction):
    # Dummy wallet for init (balance not needed for invoice)
    pdf = StatementPDF(user, {"balance": 0}, [], title="Greenify Invoice")
    pdf.add_page()
    
    # Bill To Section
    pdf.set_y(40)
    pdf.set_font('helvetica', 'B', 12)
    pdf.cell(0, 8, "Bill To:", ln=True)
    pdf.set_font('helvetica', '', 11)
    pdf.cell(0, 6, user.get('name', 'Valued Customer'), ln=True)
    pdf.cell(0, 6, user.get('email', ''), ln=True)
    
    # Invoice Details (Right aligned? Or just below)
    # Let's put Order ID and Date on the right side if possible, or just below
    pdf.set_y(40)
    pdf.set_x(120)
    pdf.set_font('helvetica', 'B', 11)
    pdf.cell(30, 8, "Order ID:", border=0)
    pdf.set_font('helvetica', '', 11)
    pdf.cell(0, 8, str(transaction.get('order_id', 'N/A')), ln=True)
    
    pdf.set_x(120)
    pdf.set_font('helvetica', 'B', 11)
    pdf.cell(30, 8, "Date:", border=0)
    pdf.set_font('helvetica', '', 11)
    ts = str(transaction.get('timestamp', 'N/A'))
    if 'T' in ts: ts = ts.split('T')[0]
    pdf.cell(0, 8, ts, ln=True)
    
    pdf.ln(20)
    
    # Items Table
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font('helvetica', 'B', 10)
    # Columns: Item (100), Qty (20), Cost (30), Total (30)
    pdf.cell(100, 10, "Item / Description", border=1, fill=True)
    pdf.cell(20, 10, "Qty", border=1, fill=True, align='C')
    pdf.cell(30, 10, "Unit Cost", border=1, fill=True, align='R')
    pdf.cell(30, 10, "Total (GP)", border=1, fill=True, align='R')
    pdf.ln()
    
    pdf.set_font('helvetica', '', 10)
    items = transaction.get('items', [])
    if not items:
        # Fallback if items not in tx (e.g. legacy)
        items = [{"title": transaction.get("description", "Unknown Item"), "quantity": 1, "cost": abs(transaction.get("amount", 0))}]

    grand_total = 0
    
    for item in items:
        title = str(item.get('title', 'Unknown Item'))
        # Sanitize
        title = title.encode('latin-1', 'replace').decode('latin-1')
        qty = item.get('quantity', 1)
        cost = item.get('cost', 0)
        total = cost * qty
        grand_total += total
        
        pdf.cell(100, 10, title, border=1)
        pdf.cell(20, 10, str(qty), border=1, align='C')
        pdf.cell(30, 10, str(cost), border=1, align='R')
        pdf.cell(30, 10, str(total), border=1, align='R')
        pdf.ln()

    # Total
    pdf.ln(5)
    pdf.set_font('helvetica', 'B', 12)
    pdf.cell(150, 10, "GRAND TOTAL", border=0, align='R')
    pdf.set_fill_color(230, 255, 230) # Light green background for total
    pdf.cell(30, 10, f"{grand_total} GPs", border=1, align='R', fill=True)
    pdf.ln(20)
    
    # Footer Note
    pdf.set_y(-40)
    pdf.set_font('helvetica', 'I', 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(0, 5, "Thank you for shopping specifically for the environment with Greenify! Your eco-friendly choices make a big difference.\n\nThis is a computer-generated invoice and requires no signature.", align='C')
    
    return pdf.output()

