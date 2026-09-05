# 🚀 Product Requirements Document (PRD): AfriRo Fuel

## **1. Project Overview**

**AfriRo** is an independent, closed-loop fuel card and station management platform built specifically for **Afric'** gas station networks in Congo-Brazzaville. The system enables individual drivers, commercial businesses, and corporate fleet managers to manage fuel credit through physical **NFC cards**.

All financial top-ups occur exclusively via **physical cash transactions** handled directly at Afric' station counters or designated branch offices. Payments at the pump are completed using physical NFC cards tapped against **Android smartphones acting as mobile POS terminals**, backed by a **mandatory offline-first architecture** to guarantee continuous operations despite local network instability.

---

## **2. Problem Statement & Market Context**

- **Network Instability:** Connectivity drops in Brazzaville, Pointe-Noire, and transit corridors stall payment terminals, creating long station queues.
- **Cash Vulnerability at the Pump:** Managing cash payments directly at the pump increases theft risk, cash handling delays, and accounting mismatches for pump attendants.
- **Paper Coupon Inefficiencies:** Companies relying on paper fuel vouchers face coupon loss, forgery, and manual reconciliation delays.
- **Hardware Cost Barriers:** Traditional dedicated POS hardware is expensive to purchase, maintain, and replace across large station networks.

---

## **3. Key System Features & Technical Capabilities**

### **A. Physical Cash Top-Up Model**

- **Over-the-Counter Cash Ingestion:** Customers purchase or reload fuel card credits by handing cash directly to an authorized Afric' cashier or station manager.
- **Counter Receipt & Audit:** Cashiers issue automated physical or digital counter receipts confirming cash intake and credit allocation.
- **No Third-Party Payment Gateway Dependency:** Eliminates digital payment integrations, transaction gateway fees, and dependence on external payment rails.

### **B. Physical NFC Cards & Security**

- **NFC Smart Cards/Fobs:** ISO 14443-compliant cards containing encrypted chips assigned unique hardware Identifiers (UID).
- **Cryptographic Vault:** Cards store local signatures and authorization metadata allowing secure cryptographic verification by POS devices during offline state.

### **C. Android SoftPOS Merchant Terminal**

- **Smartphone-as-a-POS:** Pump attendants use budget-friendly, NFC-enabled Android smartphones running the dedicated **AfriRho Merchant POS App**.
- **Instant Tap-to-Pay:** Attendants input the transaction amount (FCFA or Liters) and tap the driver's card against the smartphone to complete authorization in under two seconds.

### **D. Mandatory Offline-First Architecture**

- **Local Transaction Signing:** If cellular network is down, the SoftPOS app validates card signatures locally, logs the transaction in an encrypted local database (SQLite with SQLCipher), and deducts local balances.
- **Background Queue Synchronization:** When 3G/4G or Wi-Fi connectivity recovers, the SoftPOS app automatically syncs offline transaction ledgers to the central server without interrupting station operations.

---

## **4. Detailed Dashboard & Feature Requirements**

### **Dashboard 1: Afric' Station & Admin Portal**

```
                  +-----------------------------------+
                  |   Afric' Admin & Station Portal   |
                  +-----------------------------------+
                                    |
     +-------------------+----------+----------+-------------------+
     |                   |                     |                   |
[Card Operations]   [Cash Top-Up]      [Client Registry]    [Accounting Ledger]
 - Provision/Issue   - Cash Collection  - KYC/Onboarding     - Shift Reconciliation
 - Status: Sold/     - Instant Balance  - Fleet Account      - Sales by Fuel Type
   Active/Blocked      Crediting          Management         - Attendant Audit

```

#### **1. Card Lifecycle & Inventory Management**

- **Card Provisioning:** Register unassigned NFC cards into the inventory system by scanning their hardware UID.
- **Status Flags:** Mark cards across explicit states: _In Stock_, _Assigned_, _Sold_, _Active_, _Suspended_ (lost/stolen), or _Deactivated_.
- **Card Re-issuance:** Transfer existing balances from lost or damaged cards to newly issued cards.

#### **2. Counter Cash Top-Up Management**

- **Cash-to-Card Crediting:** Dedicated interface for station cashiers to receive cash payments, enter the amount, and credit individual driver cards or corporate account pools.
- **Audit Trail:** Every cash top-up records cashier ID, timestamp, physical cash collected, station location, and card/account UID.

#### **3. Client & Corporate Onboarding**

- **Individual Accounts:** Register retail clients with phone numbers, names, and assigned NFC card numbers.
- **Corporate Client Onboarding:** Onboard business entities, set corporate credit pools, and link multiple NFC cards to a single company entity.

#### **4. Basic Accounting & Reconciliation Ledger**

- **Shift Reconciliation:** Compare physical fuel pump meters against digital transaction logs gathered from pump attendant smartphones.
- **Offline Sync Audit:** Dedicated view flagging transaction timestamps, offline batch uploads, and potential sequence discrepancies.
- **Sales & Volume Reporting:** Export accounting reports (CSV/PDF) filtered by station, fuel type (_Super_, _Gazole_), date range, and shift team.

---

### **Dashboard 2: Corporate / Fleet Management Portal (B2B)**

```
             +---------------------------------------+
             |   Corporate / Fleet Manager Portal    |
             +---------------------------------------+
                                 |
       +-------------------------+-------------------------+
       |                                                   |
[Fleet & Card Control]                             [Analytics & Reports]
 - Assign Cards to Vehicles                         - Fuel Consumption Logs
 - Daily/Weekly Spend Caps                          - Itemized Invoices
 - Fuel Grade Lockouts                              - Real-Time Spend Feed
 - Instant Remote Freeze

```

#### **1. Fleet & Driver Allocation**

- **Card Mapping:** Link specific NFC cards to specific company drivers, employee IDs, or vehicle license plates.
- **Sub-Account Balancing:** Allocate pooled cash credits purchased at Afric' stations down to individual driver cards.

#### **2. Expense Controls & Fraud Mitigation**

- **Spending Limits:** Define maximum allowable spend per card by day, week, or month (in FCFA or Liters).
- **Fuel Type Lockouts:** Restrict cards to specific fuel grades (e.g., _Gazole only_ for diesel trucks).
- **Instant Freeze:** Instantly block compromised or unreturned cards directly from the web dashboard.

#### **3. Reporting & Invoicing**

- **Consumption Tracking:** Real-time visibility into fuel consumption across all fleet vehicles.
- **Accounting Export:** Download tax-compliant, itemized fuel statements for internal enterprise bookkeeping.

---

### **Dashboard 3: Individual Client Web/Mobile Portal (B2C)**

```
               +-----------------------------------+
               |   Individual Client User Portal   |
               +-----------------------------------+
                                 |
       +-------------------------+-------------------------+
       |                                                   |
[Card & Wallet Overview]                          [History & Utilities]
 - Cash Credit Balance                             - Digital Purchase Receipts
 - Card Status (Active/Locked)                     - Station Map Locator
 - Multi-Card Association                          - Consumption Breakdown

```

#### **1. Credit & Card Overview**

- **Balance Viewer:** Check available fuel credit loaded via cash top-ups at Afric' stations.
- **Card Control:** View associated NFC card status and temporarily lock cards if misplaced.

#### **2. History & Station Utilities**

- **Digital Receipts:** Detailed purchase history including time, station location, fuel type, price per liter, and total spent.
- **Afric' Station Locator:** Interactive map displaying Afric' gas station locations across Congo-Brazzaville.

---

## **5. Technical Architecture & Data Specifications**

### **A. Core Stack Recommendation**

- **Backend Framework:** Node.js / Go microservices for high-concurrency transaction processing.
- **Database:** PostgreSQL with `pgcrypto` for encrypted sensitive records; Redis for high-speed balance caching.
- **Mobile POS Application:** Native Android (Kotlin) leveraging Android NFC Host-Based Card Emulation / Reader Mode APIs and SQLite with SQLCipher for secure offline storage.
- **Dashboard Frontend:** React / Next.js with Tailwind CSS for high-density administrative interfaces.

### **B. Data Entities & Relational Schema Overview**

```
+-------------------+       +-------------------+       +-------------------+
|     COMPANIES     |       |       USERS       |       |     STATIONS      |
+-------------------+       +-------------------+       +-------------------+
| id (PK)           |1     *| id (PK)           |       | id (PK)           |
| company_name      |<------| company_id (FK)   |       | station_name      |
| credit_balance    |       | phone_number      |       | location_city     |
+-------------------+       +-------------------+       +-------------------+
                                      |                           |
                                     1|                           |1
                                      |                           |
                                     *|                           |*
+-------------------+       +-------------------+       +-------------------+
|    TOPUP_LOGS     |       |     NFC_CARDS     |       |   POS_TERMINALS   |
+-------------------+       +-------------------+       +-------------------+
| id (PK)           |       | card_uid (PK)     |       | device_id (PK)    |
| card_uid (FK)     |*     1| user_id (FK)      |       | station_id (FK)   |
| cashier_id (FK)   |<------| status            |       | app_version       |
| cash_amount_fcfa  |       | balance_fcfa      |       +-------------------+
| timestamp         |       +-------------------+                 |
+-------------------+                 |                           |
                                     1|                           |1
                                      |                           |
                                     *|                           |*
                            +-----------------------------------------------+
                            |                 TRANSACTIONS                  |
                            +-----------------------------------------------+
                            | id (PK)                                       |
                            | card_uid (FK)                                 |
                            | device_id (FK)                                |
                            | amount_fcfa                                   |
                            | liters                                        |
                            | is_offline_flag                               |
                            | sync_timestamp                                |
                            +-----------------------------------------------+

```

---

## **6. Non-Functional Requirements**

- **Performance:** Pump transactions must authorize within **< 1.5 seconds** at the POS terminal in both online and offline modes.
- **Security:** POS apps must utilize encrypted local keystores (Android KeyStore); plain-text card numbers or keys must never be stored on device storage.
- **Reliability:** The SoftPOS offline engine must store up to **5,000 offline transactions per phone** without performance degradation before requiring cloud synchronization.
- **Auditability:** Every system balance change must be backed by an immutable ledger record tied either to a cashier cash top-up or a POS pump deduction.
