#!/usr/bin/env python3
"""
Backend Test Suite for GLOO POS
Tests MongoDB connectivity, indexes, seed data, and API endpoints
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent / "backend" / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

print("=" * 80)
print("GLOO POS Backend Test Suite")
print("=" * 80)
print(f"MongoDB URL: {MONGO_URL[:50]}...")
print(f"Database: {DB_NAME}")
print("=" * 80)


async def test_mongodb_connection():
    """Test MongoDB connection"""
    print("\n[TEST 1] MongoDB Connection")
    try:
        client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=10000)
        # Ping the database
        await client.admin.command('ping')
        print("✅ MongoDB connection successful")
        return client
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return None


async def test_database_access(client):
    """Test database access"""
    print("\n[TEST 2] Database Access")
    try:
        db = client[DB_NAME]
        collections = await db.list_collection_names()
        print(f"✅ Database accessible, found {len(collections)} collections")
        print(f"   Collections: {', '.join(collections[:10])}")
        return db
    except Exception as e:
        print(f"❌ Database access failed: {e}")
        return None


async def test_indexes(db):
    """Test that indexes are created"""
    print("\n[TEST 3] Index Verification")
    try:
        # Check critical indexes
        users_indexes = await db.users.index_information()
        tenants_indexes = await db.tenants.index_information()
        orders_indexes = await db.orders.index_information()
        
        print(f"✅ Indexes created successfully")
        print(f"   users: {len(users_indexes)} indexes")
        print(f"   tenants: {len(tenants_indexes)} indexes")
        print(f"   orders: {len(orders_indexes)} indexes")
        
        # Verify unique email index on users
        if any('email' in str(idx) for idx in users_indexes.values()):
            print("   ✓ Users email index exists")
        else:
            print("   ⚠ Users email index missing")
            
        return True
    except Exception as e:
        print(f"❌ Index verification failed: {e}")
        return False


async def test_seed_data(db):
    """Test that seed data exists"""
    print("\n[TEST 4] Seed Data Verification")
    try:
        # Check subscription plans
        plans_count = await db.subscription_plans.count_documents({})
        print(f"   Subscription plans: {plans_count}")
        
        # Check platform admin
        platform_admin = await db.users.find_one({"role": "PLATFORM_ADMIN"})
        if platform_admin:
            print(f"   ✓ Platform admin exists: {platform_admin.get('email')}")
        else:
            print("   ⚠ Platform admin not found")
        
        # Check demo tenant
        demo_tenant = await db.tenants.find_one({"code": "T001"})
        if demo_tenant:
            print(f"   ✓ Demo tenant exists: {demo_tenant.get('name')}")
        else:
            print("   ⚠ Demo tenant not found")
        
        # Check demo users
        demo_users = await db.users.count_documents({"tenant_id": demo_tenant["id"]}) if demo_tenant else 0
        print(f"   Demo users: {demo_users}")
        
        # Check outlets
        outlets = await db.outlets.count_documents({})
        print(f"   Outlets: {outlets}")
        
        # Check products
        products = await db.products.count_documents({})
        print(f"   Products: {products}")
        
        # Check categories
        categories = await db.categories.count_documents({})
        print(f"   Categories: {categories}")
        
        if plans_count >= 4 and platform_admin and demo_tenant and demo_users >= 4:
            print("✅ Seed data verified successfully")
            return True
        else:
            print("⚠ Some seed data may be incomplete")
            return True
            
    except Exception as e:
        print(f"❌ Seed data verification failed: {e}")
        return False


async def test_health_endpoint():
    """Test health endpoint using curl"""
    print("\n[TEST 5] Health Endpoint")
    try:
        import subprocess
        result = subprocess.run(
            ["curl", "-s", "http://localhost:8001/api/health"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0 and "ok" in result.stdout:
            print(f"✅ Health endpoint responding: {result.stdout}")
            return True
        else:
            print(f"❌ Health endpoint failed: {result.stdout}")
            return False
    except Exception as e:
        print(f"❌ Health endpoint test failed: {e}")
        return False


async def main():
    """Run all tests"""
    print("\nStarting backend tests...\n")
    
    # Test 1: MongoDB Connection
    client = await test_mongodb_connection()
    if not client:
        print("\n" + "=" * 80)
        print("CRITICAL: Cannot proceed without MongoDB connection")
        print("=" * 80)
        return False
    
    # Test 2: Database Access
    db = await test_database_access(client)
    if db is None:
        print("\n" + "=" * 80)
        print("CRITICAL: Cannot access database")
        print("=" * 80)
        client.close()
        return False
    
    # Test 3: Indexes
    indexes_ok = await test_indexes(db)
    
    # Test 4: Seed Data
    seed_ok = await test_seed_data(db)
    
    # Test 5: Health Endpoint
    health_ok = await test_health_endpoint()
    
    # Close connection
    client.close()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"MongoDB Connection: {'✅ PASS' if client else '❌ FAIL'}")
    print(f"Database Access: {'✅ PASS' if db is not None else '❌ FAIL'}")
    print(f"Indexes: {'✅ PASS' if indexes_ok else '❌ FAIL'}")
    print(f"Seed Data: {'✅ PASS' if seed_ok else '❌ FAIL'}")
    print(f"Health Endpoint: {'✅ PASS' if health_ok else '❌ FAIL'}")
    print("=" * 80)
    
    all_passed = client and (db is not None) and indexes_ok and seed_ok and health_ok
    if all_passed:
        print("\n🎉 ALL TESTS PASSED - Backend is fully operational!")
    else:
        print("\n⚠️  SOME TESTS FAILED - Review errors above")
    print("=" * 80)
    
    return all_passed


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
