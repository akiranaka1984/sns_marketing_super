"""
DuoPlus API Client
Handles communication with DuoPlus virtual Android devices
"""
import os
import httpx
from typing import Optional, Any


class DuoPlusClient:
    """Client for DuoPlus API"""

    BASE_URL = "https://openapi.duoplus.net"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("DUOPLUS_API_KEY")
        if not self.api_key:
            raise ValueError("DUOPLUS_API_KEY is required")

        self.headers = {
            "DuoPlus-API-Key": self.api_key,
            "Content-Type": "application/json"
        }

    async def get_devices(self) -> list[dict]:
        """Get list of available devices"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/devices",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def get_screenshot(self, device_id: str) -> bytes:
        """Get screenshot from device"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/devices/{device_id}/screenshot",
                headers=self.headers
            )
            response.raise_for_status()
            return response.content

    async def tap(self, device_id: str, x: int, y: int) -> dict:
        """Tap at coordinates on device"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/devices/{device_id}/tap",
                headers=self.headers,
                json={"x": x, "y": y}
            )
            response.raise_for_status()
            return response.json()

    async def input_text(self, device_id: str, text: str) -> dict:
        """Input text on device"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/devices/{device_id}/input",
                headers=self.headers,
                json={"text": text}
            )
            response.raise_for_status()
            return response.json()

    async def swipe(
        self,
        device_id: str,
        start_x: int,
        start_y: int,
        end_x: int,
        end_y: int,
        duration_ms: int = 300
    ) -> dict:
        """Swipe on device"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/devices/{device_id}/swipe",
                headers=self.headers,
                json={
                    "startX": start_x,
                    "startY": start_y,
                    "endX": end_x,
                    "endY": end_y,
                    "duration": duration_ms
                }
            )
            response.raise_for_status()
            return response.json()

    async def get_ui_dump(self, device_id: str) -> str:
        """Get UIAutomator XML dump"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/devices/{device_id}/uidump",
                headers=self.headers
            )
            response.raise_for_status()
            return response.text
