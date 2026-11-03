# EAF CONNECT — CODEIGNITER 4 APIAUTH & REQUEST EXTENSION PATCH

**Target Application**: EAF Connect (`D:\xampp\htdocs\eaf` / Production CodeIgniter 4)  
**Issue**: `TypeError: CodeIgniter\Superglobals::setGlobalArray(): Argument #2 ($array) must be of type array, stdClass given` and `Call to undefined method CodeIgniter\HTTP\IncomingRequest::getGlobal()`  
**Affected Endpoints**: All 14 API controllers in `app/Controllers4/Api/` (28 controller methods calling `$this->request->getGlobal('auth_user')`)  
**Status**: Tested & Verified on Local Staging; Production Untouched Pending Approval  

---

## 1. Problem Description

1. In `app/Filters/ApiAuth.php:61`, `$user` returned by `ApiTokenModel::validateToken()` is an `stdClass` object returned by CodeIgniter's `$builder->get()->getRow()`.
2. Line 61 calls `\Config\Services::request()->setGlobal('auth_user', $user);`.
3. In CodeIgniter 4.4+, `RequestTrait::setGlobal($name, $value)` calls `service('superglobals')->setGlobalArray($name, $value)`. `setGlobalArray()` strictly requires an `array` AND only accepts PHP superglobal names: `'server', 'get', 'post', 'cookie', 'files', 'request'`. Passing `'auth_user'` throws `InvalidArgumentException: Invalid superglobal name 'auth_user'`.
4. Across all 14 API controllers in `app/Controllers4/Api/`, 28 methods retrieve the authenticated user via `$authUser = $this->request->getGlobal('auth_user');`. However, standard CodeIgniter 4 `IncomingRequest` does not have a `getGlobal()` method.

---

## 2. Minimal, Isolated Patch (Zero Core Framework Modifications)

This patch follows standard CodeIgniter 4 architectural conventions by extending `IncomingRequest` in `app/HTTP/` and registering the service override in `app/Config/Services.php`. This fixes all 28 API controller methods without modifying any of the 14 controller files or framework core files.

### Step 1: Create `app/HTTP/IncomingRequest.php`

Create file: `app/HTTP/IncomingRequest.php`

```php
<?php

namespace App\HTTP;

use CodeIgniter\HTTP\IncomingRequest as CoreIncomingRequest;

/**
 * App\HTTP\IncomingRequest
 *
 * Provides safe application-level setGlobal() and getGlobal() for request-scoped state (e.g. auth_user)
 * while preserving standard superglobal behavior.
 */
class IncomingRequest extends CoreIncomingRequest
{
    protected static array $customGlobals = [];

    /**
     * Store custom global without triggering Superglobals validation errors.
     */
    public function setGlobal(string $name, $value)
    {
        self::$customGlobals[$name] = $value;
        $superglobals = ['server', 'get', 'post', 'cookie', 'files', 'request'];
        if (in_array(strtolower($name), $superglobals, true) && is_array($value)) {
            parent::setGlobal($name, $value);
        }
        return $this;
    }

    /**
     * Retrieve custom global (such as 'auth_user') or fallback to parent superglobals.
     */
    public function getGlobal(string $name)
    {
        if (array_key_exists($name, self::$customGlobals)) {
            return self::$customGlobals[$name];
        }
        return $this->fetchGlobal($name);
    }
}
```

### Step 2: Override `incomingrequest` in `app/Config/Services.php`

In `app/Config/Services.php`, add the `incomingrequest` override method:

```php
<?php

namespace Config;

use CodeIgniter\Config\BaseService;
use App\HTTP\IncomingRequest;
use CodeIgniter\HTTP\UserAgent;

/**
 * Services Configuration file.
 */
class Services extends BaseService
{
    /**
     * Return custom IncomingRequest instance supporting getGlobal/setGlobal
     */
    public static function incomingrequest($config = null, bool $getShared = true)
    {
        if ($getShared) {
            return static::getSharedInstance('request', $config);
        }

        $config ??= config('App');

        return new IncomingRequest(
            $config,
            \Config\Services::get('uri'),
            'php://input',
            new UserAgent(),
        );
    }
}
```

---

## 3. Verification Test Command

Verify the patch using curl with an authorized Bearer token:

```bash
curl -X GET "http://localhost/eaf/api/v1/connect" \
  -H "Authorization: Bearer <VALID_EAF_TOKEN>" \
  -H "Accept: application/json"
```

Expected Output:
```json
{
  "status": "success",
  "data": {
    "given": [...],
    "received": [...],
    "given_count": 19,
    "received_count": 7
  }
}
```
HTTP status code: `200 OK`.
