from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
from sqlalchemy import select
from .database import init_db, SessionLocal
from .models import User, Shop, Membership, Customer, LedgerEntry
from .security import hash_password

PHONE = "01712987654"
PASSWORD = "Demo@12345"


def seed():
    init_db()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.phone == PHONE))
        if user:
            print("Demo account already exists. No changes made.")
            print(f"Phone: {PHONE}\nPassword: {PASSWORD}")
            return
        user = User(phone=PHONE, full_name="আব্দুর রহিম", password_hash=hash_password(PASSWORD))
        shop = Shop(name="রহিম জেনারেল স্টোর", address="সদর বাজার, চন্দনাইশ", business_type="grocery")
        db.add(user); db.add(shop); db.flush()
        db.add(Membership(user_id=user.id, shop_id=shop.id, role="owner"))
        today = date.today()
        now = datetime.now(timezone.utc)
        customers = [
            ("demo-customer-sami-north", "সামী", "উত্তরপাড়া", "01711001122", 2500),
            ("demo-customer-sami-market", "সামী", "বাজার রোড", "01812334455", 800),
            ("demo-customer-kashem", "কাশেম ভাই", "উত্তরপাড়া", "01712345678", 7420),
            ("demo-customer-rafiq", "রফিজুল ইসলাম", "উত্তরপাড়া", "01788112233", 12600),
            ("demo-customer-mobarak", "মোবারক মিয়া", "দক্ষিণপাড়া", "01911223344", 8300),
            ("demo-customer-anwar", "আনোয়ার মাস্টার", "স্কুলপাড়া", "01811445566", 1850),
            ("demo-customer-sajeda", "সাজেদা বেগম", "স্কুলপাড়া", "01611778899", 0),
        ]
        for cid, name, area, phone, balance in customers:
            db.add(Customer(id=cid, shop_id=shop.id, name=name, area=area, phone=phone))
            opening = balance
            if cid == "demo-customer-kashem": opening = 8920
            if cid == "demo-customer-anwar": opening = 2350
            if cid == "demo-customer-sajeda": opening = 1200
            if opening > 0:
                db.add(LedgerEntry(
                    shop_id=shop.id, customer_id=cid, entry_type="DUE", amount_paisa=opening*100,
                    business_date=today-timedelta(days=10), note="শুরুর জের (Opening Balance)",
                    channel="opening", operation_id=f"seed:{cid}:opening", actor_id=user.id,
                ))
        # Kashem: 8,920 opening + 1,500 due - 3,000 payment = 7,420.
        db.add(LedgerEntry(shop_id=shop.id, customer_id="demo-customer-kashem", entry_type="DUE", amount_paisa=1500*100, business_date=today, note="তীর সয়াবিন তেল ও মুদি বাজার", channel="cash", operation_id="seed:kashem:due1", actor_id=user.id))
        db.add(LedgerEntry(shop_id=shop.id, customer_id="demo-customer-kashem", entry_type="PAYMENT", amount_paisa=3000*100, business_date=today-timedelta(days=2), note="বিকাশ মারফত পরিশোধ", channel="bkash", operation_id="seed:kashem:payment1", actor_id=user.id))
        # Anwar: 2,350 opening - 500 payment = 1,850.
        db.add(LedgerEntry(shop_id=shop.id, customer_id="demo-customer-anwar", entry_type="PAYMENT", amount_paisa=500*100, business_date=today-timedelta(days=1), note="আংশিক কিস্তি জমা", channel="cash", operation_id="seed:anwar:payment1", actor_id=user.id))
        # Sajeda: 1,200 opening - 1,200 payment = zero.
        db.add(LedgerEntry(shop_id=shop.id, customer_id="demo-customer-sajeda", entry_type="PAYMENT", amount_paisa=1200*100, business_date=today, note="সম্পূর্ণ বাকি নগদ পরিশোধ", channel="cash", operation_id="seed:sajeda:payment1", actor_id=user.id))
        db.commit()
        print("Demo account created successfully.")
        print(f"Phone: {PHONE}\nPassword: {PASSWORD}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
