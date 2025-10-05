import os
import json
from datetime import datetime
import pyodbc
from azure.storage.blob import BlobServiceClient
from applicationinsights import TelemetryClient
import sys
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class AzureConfig:
    SQL_SERVER = os.getenv("AZURE_SQL_SERVER", "seesound-server.database.windows.net")
    SQL_DATABASE = os.getenv("AZURE_SQL_DATABASE", "seesound_db")
    SQL_USERNAME = os.getenv("AZURE_SQL_USER", "adminuser")
    SQL_PASSWORD = os.getenv("AZURE_SQL_PASSWORD", "your_password")
    
    BLOB_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "your_connection_string")
    BLOB_CONTAINER_LOGS = "app-logs"
    
    BACKEND_API_URL = os.getenv("BACKEND_API_URL", "https://seesound-api.azurewebsites.net")
    
    APP_INSIGHTS_KEY = os.getenv("APPINSIGHTS_INSTRUMENTATIONKEY", "your_instrumentation_key")

class AzureSQLService:
    
    def __init__(self):
        self.connection_string = (
            f"DRIVER={{ODBC Driver 18 for SQL Server}};"
            f"SERVER={AzureConfig.SQL_SERVER};"
            f"DATABASE={AzureConfig.SQL_DATABASE};"
            f"UID={AzureConfig.SQL_USERNAME};"
            f"PWD={AzureConfig.SQL_PASSWORD}"
        )
        self.enabled = True
        try:
            self._init_database()
        except Exception as e:
            print(f"[AZURE SQL] Warning: Could not connect - {e}. Running in offline mode.")
            self.enabled = False
    
    def _init_database(self):
        conn = pyodbc.connect(self.connection_string)
        cursor = conn.cursor()
        
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserPreferences' AND xtype='U')
            CREATE TABLE UserPreferences (
                user_id NVARCHAR(100) PRIMARY KEY,
                tts_speed FLOAT DEFAULT 1.0,
                announcement_interval INT DEFAULT 10,
                priority_mode NVARCHAR(50) DEFAULT 'dynamic',
                created_at DATETIME DEFAULT GETDATE(),
                updated_at DATETIME DEFAULT GETDATE()
            )
        """)
        
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QueryHistory' AND xtype='U')
            CREATE TABLE QueryHistory (
                id INT IDENTITY(1,1) PRIMARY KEY,
                user_id NVARCHAR(100),
                question NVARCHAR(MAX),
                answer NVARCHAR(MAX),
                timestamp DATETIME DEFAULT GETDATE()
            )
        """)
        
        conn.commit()
        conn.close()
        print("[AZURE SQL] Database initialized successfully")

    def get_user_preferences(self, user_id: str) -> dict:
        DEFAULT_PREFS = {
            'tts_speed': 1.0, 
            'announcement_interval': 10, 
            'priority_mode': 'dynamic'
        }
        
        if not self.enabled: 
            return DEFAULT_PREFS
        
        conn = None
        try:
            conn = pyodbc.connect(self.connection_string)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT tts_speed, announcement_interval, priority_mode FROM UserPreferences WHERE user_id = ?", 
                (user_id,)
            )
            row = cursor.fetchone()
            
            if row:
                print(f"[SQL] Loaded preferences for user {user_id}")
                return {
                    'tts_speed': row[0],
                    'announcement_interval': row[1],
                    'priority_mode': row[2]
                }
            else:
                return DEFAULT_PREFS

        except Exception as e:
            print(f"[SQL ERROR] Cannot retrieve user preferences: {e}")
            return DEFAULT_PREFS
        finally:
            if conn: conn.close()
            
    def save_user_preferences(self, user_id: str, speed: float, interval: int, mode: str):
        if not self.enabled: return
        
        conn = None
        try:
            conn = pyodbc.connect(self.connection_string)
            cursor = conn.cursor()

            params = (user_id, speed, interval, mode)
            
            cursor.execute(
                """
                MERGE INTO UserPreferences AS Target
                USING (VALUES (?, ?, ?, ?)) AS Source (user_id, tts_speed, announcement_interval, priority_mode)
                ON (Target.user_id = Source.user_id)
                WHEN MATCHED THEN
                    UPDATE SET 
                        tts_speed = Source.tts_speed, 
                        announcement_interval = Source.announcement_interval,
                        priority_mode = Source.priority_mode,
                        updated_at = GETDATE()
                WHEN NOT MATCHED BY TARGET THEN
                    INSERT (user_id, tts_speed, announcement_interval, priority_mode, created_at, updated_at)
                    VALUES (Source.user_id, Source.tts_speed, Source.announcement_interval, Source.priority_mode, GETDATE(), GETDATE());
                """,
                params
            )

            conn.commit()
            print(f"[SQL] Preferences for user {user_id} saved/updated successfully.")
            
        except Exception as e:
            print(f"[SQL ERROR] Could not save user preferences: {e}")
        finally:
            if conn: conn.close()

    def log_query(self, user_id: str, question: str, answer: str):
        if not self.enabled: return
        try:
            conn = pyodbc.connect(self.connection_string)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO QueryHistory (user_id, question, answer) VALUES (?, ?, ?)",
                (user_id, question, answer)
            )
            conn.commit()
            conn.close()
            print(f"[SQL] Query logged for user {user_id}.")
        except Exception as e:
            print(f"[AZURE SQL ERROR] Could not log query: {e}")

class BlobService:
    def __init__(self):
        self.container_name = AzureConfig.BLOB_CONTAINER_LOGS
        self.enabled = True
        try:
            self.blob_service_client = BlobServiceClient.from_connection_string(
                AzureConfig.BLOB_CONNECTION_STRING
            )
            container_client = self.blob_service_client.get_container_client(self.container_name)
            if not container_client.exists():
                container_client.create_container()
            print("[AZURE BLOB] Service initialized.")
        except Exception as e:
            self.enabled = False

class MonitoringService:
    def __init__(self):
        self.enabled = True
        self.tc = None
        if AzureConfig.APP_INSIGHTS_KEY and "your_instrumentation_key" not in AzureConfig.APP_INSIGHTS_KEY:
            try:
                self.tc = TelemetryClient(AzureConfig.APP_INSIGHTS_KEY)
                print("[AZURE MONITOR] Service initialized.")
            except Exception as e:
                self.enabled = False
        else:
            self.enabled = False
    
    def track_detection(self, label: str, confidence: float, priority: int):
        if not self.enabled: return
        self.tc.track_event(
            "YOLO_Detection",
            properties={"label": label, "priority": priority},
            measurements={"confidence": confidence}
        )
        self.tc.flush()
    
    def track_query(self, question: str, response_time: float):
        if not self.enabled: return
        self.tc.track_metric("BLIP_ResponseTime", response_time)
        self.tc.track_event(
            "BLIP_Query",
            properties={"question": question}
        )
        self.tc.flush()
        
    def track_event(self, name: str, properties: Optional[dict] = None):
        if not self.enabled: return
        self.tc.track_event(name, properties)
        self.tc.flush()
        
    def track_error(self, message: str, component: str):
        if not self.enabled: return
        self.tc.track_exception(
            sys.exc_info(),
            properties={"message": message, "component": component}
        )
        self.tc.flush()
        
    def flush(self):
        if self.tc: self.tc.flush()

class AuthService:
    def __init__(self):
        self.is_authenticated = False
        self.user_id: Optional[str] = None

    def login(self) -> bool:
        print("-" * 50)
        print("AZURE AUTHENTICATION SIMULATION")
        print("-" * 50)
        
        mock_user_name = "default_simulated_user"
        if os.environ.get("HEADLESS_MODE") != "true":
            try:
                mock_user_name = input("Enter a unique User Name (e.g., 'prof_sachin' or 'user123'): ")
            except EOFError:
                pass 
        
        if mock_user_name and mock_user_name != "default_simulated_user":
            self.user_id = mock_user_name.lower().replace(" ", "_")
            self.is_authenticated = True
            print(f"[AUTH] Login successful. User ID set to: {self.user_id}")
            print("-" * 50)
            return True
        else:
            self.user_id = "guest_user"
            print("[AUTH] Login skipped/failed. Using default 'guest_user'.")
            print("-" * 50)
            return False
            
    def get_current_user_id(self) -> str:
        return self.user_id if self.user_id else "guest_user"


class AzureServicesManager:
    
    def __init__(self):
        
        self.auth = AuthService()
        self.auth.login()
        self.user_id = self.auth.get_current_user_id()

        self.blob = BlobService()
        self.monitor = MonitoringService()
        self.sql = AzureSQLService() 
        
        self.user_prefs = self.sql.get_user_preferences(self.user_id)
        
        if self.user_id != "guest_user":
            self.sql.save_user_preferences(
                self.user_id, 
                self.user_prefs['tts_speed'], 
                self.user_prefs['announcement_interval'], 
                self.user_prefs['priority_mode']
            )

        print(f"[AZURE] Cloud services ready! Current User ID: {self.user_id}")
        
    def cleanup(self):
        self.monitor.flush()
        print("[AZURE] Services cleaned up")