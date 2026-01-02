# DuoPlus API Notes

## Cloud Phone List API

**Endpoint:** `POST /api/v1/cloudPhone/list`

**Request Parameters:**
- `page`: int (optional) - Request page number, defaults to 1
- `pagesize`: int (optional) - Number of items per page, defaults to 10, max 100
- `link_status`: array (optional) - Status filter
  - 0: Not configured
  - 1: Powered on
  - 2: Powered off
  - 3: Expired
  - 4: Renewal overdue
  - 10: Powering on
  - 11: Configuring
  - 12: Configuration failed

**Response:**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "xx",
        "name": "xx",
        "status": 1,
        "os": "Android 12",
        "size": "30.08G",
        "created_at": "2024-04-10 19:14:56",
        "expired_at": "2024-06-10 19:14:56",
        "ip": "xx",
        "area": "xx",
        "remark": "xx",
        "adb": "127.0.0.1:20100",
        "adb_password": ""
      }
    ],
    "page": 1,
    "pagesize": 10,
    "total": 1,
    "total_page": 1
  },
  "message": "Success"
}
```

## Current Issue

Getting error code 160000: "Sorry, you do not have enough permissions to perform this operation"

This suggests the API key may not have sufficient permissions for the `/api/v1/cloudPhone/list` endpoint.

## Workaround

Manually register known device IDs in the database:
- s0t85
- snap_LVdTJ
- snap_fmnPp
- snap_pJciL
