"""
Test script to verify backend API integration
"""
import sys
import requests
import json
from pathlib import Path

# Add the parent directory to the Python path so we can import backend modules
sys.path.insert(0, str(Path(__file__).parent))

def test_backend_api():
    base_url = "http://localhost:8000"
    
    print("🧪 Testing Backend API Integration")
    print("=" * 50)
    
    try:
        # Test 1: Health check - API data endpoint
        print("1. Testing /api/data endpoint...")
        response = requests.get(f"{base_url}/api/data", timeout=5)
        response.raise_for_status()
        data = response.json()
        
        print(f"   ✅ Success! Retrieved {len(data)} datasets")
        for filename, records in data.items():
            print(f"   - {filename}: {len(records)} records")
        
        # Test 2: Scheduler endpoint
        print("\n2. Testing /api/schedule endpoint...")
        schedule_params = {
            "cleaning_capacity": 3,
            "fail_train": None,
            "cleaning_due_threshold": 7,
            "risk_w": 50.0,
            "mileage_w": 1.0,
            "branding_w": 20.0,
            "min_clean_due": 0
        }
        
        response = requests.post(
            f"{base_url}/api/schedule",
            json=schedule_params,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        schedule_data = response.json()
        
        print(f"   ✅ Schedule generated successfully!")
        print(f"   - Status: {schedule_data.get('objective_status', 'Unknown')}")
        print(f"   - Trains in schedule: {len(schedule_data.get('schedule', []))}")
        
        # Count assignments
        assignments = {}
        for train in schedule_data.get('schedule', []):
            status = train.get('assigned', 'unknown')
            assignments[status] = assignments.get(status, 0) + 1
        
        print("   - Assignment breakdown:")
        for status, count in assignments.items():
            print(f"     * {status.capitalize()}: {count}")
        
        print(f"\n✅ All API tests passed! Backend is ready for React integration.")
        return True
        
    except requests.exceptions.ConnectionError:
        print("   ❌ Connection failed!")
        print("   📝 Make sure the backend is running:")
        print("      python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000")
        return False
        
    except requests.exceptions.RequestException as e:
        print(f"   ❌ API request failed: {e}")
        return False
        
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = test_backend_api()
    
    if success:
        print("\n" + "=" * 50)
        print("🎉 Integration Test Results: PASS")
        print("\n📋 Next Steps:")
        print("1. Start backend: python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload")
        print("2. Start React frontend: cd frontend_new && npm run dev")
        print("3. Open React app: http://localhost:5173")
        print("\nOr use the automated script: run-dev-servers.bat")
    else:
        print("\n" + "=" * 50)
        print("❌ Integration Test Results: FAIL")
        print("Please start the backend server and try again.")
    
    sys.exit(0 if success else 1)