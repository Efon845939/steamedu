#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
import uuid

class STEAMPlatformTester:
    def __init__(self, base_url="https://interactive-stem-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    self.log_test(name, True)
                    return True, response_data
                except:
                    self.log_test(name, True, "No JSON response")
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return False, {}

        except requests.exceptions.RequestException as e:
            error_msg = f"Request failed: {str(e)}"
            self.log_test(name, False, error_msg)
            return False, {}

    def test_health_check(self):
        """Test if the API is accessible"""
        try:
            response = requests.get(f"{self.base_url}/docs", timeout=5)
            if response.status_code == 200:
                self.log_test("API Health Check", True)
                return True
            else:
                self.log_test("API Health Check", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("API Health Check", False, str(e))
            return False

    def test_user_registration(self):
        """Test user registration"""
        test_user = {
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "username": f"testuser_{uuid.uuid4().hex[:8]}",
            "password": "TestPass123!",
            "full_name": "Test User"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if success:
            self.user_data = test_user
            return True
        return False

    def test_user_login(self):
        """Test user login"""
        if not self.user_data:
            self.log_test("User Login", False, "No user data available")
            return False
            
        login_data = {
            "username": self.user_data["username"],
            "password": self.user_data["password"]
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        if not self.token:
            self.log_test("Get Current User", False, "No auth token available")
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_seed_data(self):
        """Test seeding sample data"""
        success, response = self.run_test(
            "Seed Sample Data",
            "POST",
            "seed-data",
            200
        )
        return success

    def test_get_quizzes(self):
        """Test getting quizzes"""
        success, response = self.run_test(
            "Get Quizzes",
            "GET",
            "quizzes",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} quizzes")
            return True, response
        return False, []

    def test_quiz_attempt(self, quiz_id):
        """Test submitting a quiz attempt"""
        if not self.token:
            self.log_test("Quiz Attempt", False, "No auth token available")
            return False
            
        attempt_data = {
            "answers": [
                {"question_index": 0, "selected": "H2O"},
                {"question_index": 1, "selected": "Mercury"}
            ]
        }
        
        success, response = self.run_test(
            "Quiz Attempt",
            "POST",
            f"quizzes/{quiz_id}/attempt",
            200,
            data=attempt_data
        )
        
        if success and 'score' in response:
            print(f"   Quiz score: {response['score']}%")
            return True
        return False

    def test_create_idea(self):
        """Test creating an idea"""
        if not self.token:
            self.log_test("Create Idea", False, "No auth token available")
            return False
            
        idea_data = {
            "title": "Test Renewable Energy Project",
            "description": "A project to build a small wind turbine using recycled materials to demonstrate sustainable energy generation.",
            "category": "Science"
        }
        
        success, response = self.run_test(
            "Create Idea",
            "POST",
            "ideas",
            200,
            data=idea_data
        )
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_get_ideas(self):
        """Test getting ideas"""
        success, response = self.run_test(
            "Get Ideas",
            "GET",
            "ideas",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} ideas")
            return True, response
        return False, []

    def test_like_idea(self, idea_id):
        """Test liking an idea"""
        if not self.token or not idea_id:
            self.log_test("Like Idea", False, "No auth token or idea ID available")
            return False
            
        success, response = self.run_test(
            "Like Idea",
            "POST",
            f"ideas/{idea_id}/like",
            200
        )
        return success

    def test_get_activities(self):
        """Test getting activities"""
        success, response = self.run_test(
            "Get Activities",
            "GET",
            "activities",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} activities")
            return True
        return False

    def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 Starting STEAM Platform API Testing")
        print("=" * 50)
        
        # Basic connectivity
        if not self.test_health_check():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Authentication flow
        if not self.test_user_registration():
            print("❌ User registration failed. Stopping tests.")
            return False
            
        if not self.test_user_login():
            print("❌ User login failed. Stopping tests.")
            return False
            
        if not self.test_get_current_user():
            print("❌ Get current user failed.")
        
        # Seed data
        self.test_seed_data()
        
        # Quiz functionality
        quiz_success, quizzes = self.test_get_quizzes()
        if quiz_success and quizzes:
            # Try to attempt the first quiz
            self.test_quiz_attempt(quizzes[0]['id'])
        
        # Ideas functionality
        idea_success, idea_id = self.test_create_idea()
        self.test_get_ideas()
        if idea_success and idea_id:
            self.test_like_idea(idea_id)
        
        # Activities
        self.test_get_activities()
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        print(f"Total tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # Save detailed results
        results = {
            "summary": {
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "failed_tests": self.tests_run - self.tests_passed,
                "success_rate": (self.tests_passed/self.tests_run)*100,
                "timestamp": datetime.now().isoformat()
            },
            "test_results": self.test_results
        }
        
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
        
        return self.tests_passed == self.tests_run

def main():
    tester = STEAMPlatformTester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())