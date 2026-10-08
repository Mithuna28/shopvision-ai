import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
base_dir = Path(__file__).resolve().parent
load_dotenv(base_dir / ".env")
load_dotenv(base_dir / "backend" / ".env")

def test_supabase_connection():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("ERROR: SUPABASE_URL or SUPABASE_KEY is not set.")
        print("Please configure SUPABASE_URL and SUPABASE_KEY in your .env file.")
        sys.exit(1)

    if "YOUR_PROJECT" in supabase_url or "YOUR_SERVER_SIDE_KEY" in supabase_key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY contain placeholder values.")
        print("Please replace placeholder values with your actual Supabase project credentials in .env.")
        sys.exit(1)

    try:
        from supabase import create_client
        client = create_client(supabase_url, supabase_key)
        
        # Perform harmless query to test connection
        client.table("jobs").select("job_id").limit(1).execute()
        print("SUPABASE CONNECTED")
        return True
    except Exception as e:
        print(f"ERROR: Failed to connect to Supabase: {type(e).__name__}: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_supabase_connection()
