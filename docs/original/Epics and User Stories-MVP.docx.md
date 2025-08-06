**Epics and User Stories for Sensor Management Platform Initial Launch**

# Epic 1: Hierarchical Data Management

**Description**: Enable the system to organize and manage data in a hierarchical structure (Organization → Subsidiary → Location → Department → Sensor) to support multi-tenant operations and sensor tracking.

## **User Story 1.1: Add and Configure Entities**

**As an** Organization Admin,  
**I want to** add and configure subsidiaries, locations, departments, and sensors,  
**so that** I can set up my organization’s structure and monitor sensor data.

**Acceptance Criteria**:

* I can add a subsidiary with a name and basic details (e.g., address).  
* I can add a location under a subsidiary with a name, ID, and address.  
* I can add a department under a location with a name.  
* I can add a sensor under a department with a type (e.g., temperature, door) and location description.  
* The system validates required fields (e.g., name, ID) before saving.  
* Added entities are visible in the dashboard menu based on my permissions.

## **User Story 1.2: View Hierarchical Structure**

**As an** Organization Admin or Location Manager,  
**I want to** view the hierarchy of my organization, subsidiaries, locations, and departments,  
**so that** I can navigate and manage my entities effectively.

**Acceptance Criteria**:

* The dashboard displays an expandable/collapsible menu showing my organization’s subsidiaries, locations, and departments (based on my permissions).  
* Clicking an entity (e.g., location) shows its sub-entities (e.g., departments).  
* The menu reflects only the entities I have access to.  
* The interface loads within 2 seconds for up to 10 locations and 100 sensors.

# EPIC 2: CONNECT SENSOR DATA TO Golioth IoT Platform

**Description**: Integrate the sensor management platform with the Golioth IoT platform to enable secure, real-time data streaming from sensors and gateways to Golioth’s cloud services, supporting device provisioning, data routing, and monitoring for scalable IoT deployments across multi-tenant organizations.

## User Story 1: Provision Sensors and Gateways on Golioth

**As an** Organization Admin,  
**I want to** register sensors and gateways as devices on the Golioth platform,  
**so that** they can securely connect and transmit data to the Golioth cloud.

**Acceptance Criteria**:

* I can add a sensor or gateway in the platform’s Device Admin interface, specifying a unique Device ID, pre-shared key (PSK), and optional tags (e.g., location, sensor type).

* The system uses Golioth’s Management API to provision devices on the Golioth platform.

* Provisioned devices appear in the dashboard with their Golioth connectivity status (e.g., connected, disconnected).

* The system validates Device ID uniqueness and PSK format before provisioning.

* Provisioning completes within 5 seconds per device.

* Any provisioning errors (e.g., duplicate Device ID, invalid PSK) are displayed clearly in the interface.

## User Story 2: Stream Real-Time Sensor Data to Golioth LightDB Stream

**As a** Location Manager,  
**I want to** stream sensor data to Golioth’s LightDB Stream,  
**so that** I can access real-time sensor readings in the cloud for monitoring and analysis.

**Acceptance Criteria**:

* Sensors configured in the platform send data (e.g., temperature, humidity, door status) to Golioth’s LightDB Stream using the Golioth Firmware SDK (e.g., for Zephyr or ESP-IDF).

* Data is transmitted in a supported format (e.g., JSON or CBOR).

* The dashboard displays real-time sensor data retrieved from LightDB Stream (e.g., latest temperature reading).

* Data updates appear in the dashboard within 10 seconds of a sensor event.

* The system supports streaming from up to 100 sensors per location, with data sent every 10 seconds, without performance issues.

* Streaming errors (e.g., connectivity loss, data format issues) are logged and visible to Organization Admins in the audit log.

## User Story 3: Configure Golioth Pipelines for Data Routing and Notifications

**As an** Organization Admin,  
**I want to** configure Golioth Pipelines to route sensor data to external systems or trigger notifications,  
**so that** I can integrate data with other platforms or automate alerts based on sensor events.

**Acceptance Criteria**:

* I can create a Pipeline in the platform’s interface using a YAML configuration, specifying filters (e.g., temperature \> 30°C), transformations (e.g., CBOR to JSON), and destinations (e.g., email, SMS, or external webhook).

* The system uses Golioth’s REST API to save and activate Pipelines.

* I can test a Pipeline by sending a sample sensor reading to verify routing or notification behavior.

* Pipelines support at least one transformation and one destination (e.g., LightDB Stream to email notification).

* Pipeline configuration errors (e.g., invalid YAML syntax) are displayed clearly in the interface.

* Pipelines are activated within 5 seconds of saving.

## User Story 4: Monitor Golioth Data Stream Performance

**As an** Organization Admin or Technician,  
**I want to** monitor the connectivity and performance of sensor data streams to Golioth,  
**so that** I can identify and troubleshoot integration issues.

**Acceptance Criteria**:

* The dashboard includes a widget showing the number of devices connected to Golioth and their status (e.g., online, offline, last connected).

* I can view a report of data stream performance metrics (e.g., average latency, error rates) for my tenant’s devices.

* Golioth-specific errors (e.g., authentication failures, stream timeouts) are logged in the system’s audit log, accessible to Organization Admins or Technicians.

* Connectivity status updates in the dashboard within 10 seconds of a change.

* The performance report generates within 5 seconds for up to 100 devices.

## User Story 5: Handle Offline Data with Local Caching

**As a** Location Manager,  
**I want to** cache sensor data locally when internet connectivity is unavailable,  
**so that** data is transmitted to Golioth’s LightDB Stream when connectivity is restored.

**Acceptance Criteria**:

* Sensors cache up to 1 hour of data locally (e.g., readings every 10 seconds) during connectivity disruptions.

* Cached data is automatically sent to Golioth’s LightDB Stream upon reconnection.

* The system logs successful syncs and any data loss events in the audit log, accessible to Organization Admins.

* The dashboard indicates when a sensor is offline and displays the last synced data.

* Data synchronization completes within 1 minute of reconnection for up to 100 sensors.

* The system alerts me if cached data exceeds storage limits or fails to sync.

# EPIC 3: SECURITY AND ACCESS CONTROL

**Description**: Implement a secure, multi-tenant system with role-based access control to ensure data isolation and appropriate user permissions.

## **User Story 2.1: Multi-Tenant Data Isolation**

**As an** Organization Admin,  
**I want to** access only my organization’s data,  
**so that** my data remains private and isolated from other organizations.

**Acceptance Criteria**:

* Logging in with my credentials shows only my organization’s subsidiaries, locations, departments, and sensors.  
* I cannot see or access data from other organizations.  
* The system enforces tenant-specific data separation at the database level.  
* Attempting to access another tenant’s data (e.g., via URL manipulation) results in an access denied error.

## **User Story 2.2: Role-Based Access Control**

**As an** Organization Admin,  
**I want to** assign roles to users with predefined permissions,  
**so that** I can control access to subsidiaries, locations, and departments.

**Acceptance Criteria**:

* I can assign one of three predefined roles (Organization Admin, Location Manager, Read-Only) to a user.  
* Organization Admin can access all entities within their tenant.  
* Location Manager can access only their assigned location(s) and departments.  
* Read-Only users can view but not modify data.  
* Role assignments are saved and enforced upon login.

## **User Story 2.3: User Management**

**As an** Organization Admin,  
**I want to** add and manage users with unique usernames and passwords,  
**so that** I can grant access to my team members.

**Acceptance Criteria**:

* I can add a user with a unique username, strong password (8+ characters, mixed requirements), and role.  
* The system validates username uniqueness and password strength.  
* I can edit or delete users within my tenant.  
* Users are tied to my OrgID/SubID/LocID for access control.  
* Changes take effect immediately upon saving.

**User Story 2.4: Technician Admin Access**

**As a** Technician (NetNeural/V-Mark),  
**I want to** access any tenant’s data using a master admin code,  
**so that** I can assist with troubleshooting or configuration.

**Acceptance Criteria**:

* I can log in using a master username/password provided by the system provider.  
* Master access grants full visibility and control over any tenant’s data.  
* All actions performed with master access are logged (username, time/date, action).  
* The system restricts master access to authorized technicians only.

**User Story 2.5: Basic Audit Logging**

**As an** Organization Admin or Technician,  
**I want to** view a log of user activities,  
**so that** I can audit system usage for security and compliance.

**Acceptance Criteria**:

* The system logs user logins, entity modifications (add/edit/delete), and page views with username, time/date, and action.  
* I can view a report of activities within my tenant (Organization Admin) or any tenant (Technician).  
* The report is accessible only to authorized users.  
* Logs are stored for at least 30 days.

# EPIC 4: CORE INTERFACE AND DASHBOARD

**Description**: Provide a user-friendly dashboard and map-based interface for navigating and monitoring sensor data.

## **User Story 3.1: Secure Login**

**As a** User (Organization Admin, Location Manager, or Read-Only),  
**I want to** log in securely with my credentials,  
**so that** I can access my tenant’s data.

**Acceptance Criteria**:

* I can enter a unique username and password on the login screen.  
* The system validates credentials and ties them to my OrgID/SubID/LocID.  
* Invalid login attempts display a clear error message.  
* Successful login redirects to the main dashboard within 3 seconds.

## **User Story 3.2: Main Dashboard with Navigation**

**As a** User,  
**I want to** see a dashboard with an expandable menu of my entities,  
**so that** I can navigate to subsidiaries, locations, or departments I have access to.

**Acceptance Criteria**:

* The dashboard displays an expandable/collapsible menu listing subsidiaries, locations, and departments based on my permissions.  
* Clicking an entity expands to show sub-entities (e.g., departments under a location).  
* The menu is responsive and usable on desktop and mobile devices.  
* Navigation loads within 2 seconds for up to 10 locations.

## **User Story 3.3: Sensor Alert Dashboard**

**As a** User,  
**I want to** see a summary of sensor alerts on the dashboard,  
**so that** I can quickly identify issues.

**Acceptance Criteria**:

* The dashboard shows a list or count of sensors with alerts (red for critical, yellow for warning).  
* Alerts are grouped by location and department (based on permissions).  
* Clicking an alert shows the sensor’s details (type, location, status).  
* Alerts update in near real-time (within 10 seconds of a sensor status change).

## **User Story 3.4: Location-Level Map View**

**As a** Location Manager,  
**I want to** view a map of my location with sensor statuses,  
**so that** I can monitor sensor conditions visually.

**Acceptance Criteria**:

* The dashboard includes a map view for my assigned location(s).  
* Sensors are displayed on the map with color-coded statuses (green, yellow, red).  
* Clicking a sensor shows its details (type, location description, current reading).  
* The map is responsive and loads within 3 seconds for up to 100 sensors.

# Epic 5: Sensor and Gateway Management

**Description**: Enable users to add, configure, and manage sensors and gateways for monitoring.

## **User Story 4.1: Add and Manage Sensors**

**As an** Organization Admin or Location Manager,  
**I want to** add, edit, or remove sensors,  
**so that** I can maintain accurate sensor data for my departments.

**Acceptance Criteria**:

* I can add a sensor with a type (e.g., temperature, door, moisture), department, and location description.  
* I can edit or delete existing sensors within my permissions.  
* The system validates required fields (e.g., type, department).  
* Changes are reflected in the dashboard and map view immediately.

## **User Story 4.2: Add and Manage Gateways**

**As an** Organization Admin,  
**I want to** add, edit, or remove gateways,  
**so that** I can manage connectivity for sensors.

**Acceptance Criteria**:

* I can add a gateway with a name, location, and department.  
* I can edit or delete existing gateways within my tenant.  
* The system validates required fields (e.g., name, location).  
* Changes are reflected in the system immediately.

# Epic 6: Notifications

**Description**: Allow users to configure and receive notifications for sensor alerts.

## **User Story 5.1: Configure Notifications**

**As an** Organization Admin or Location Manager,  
**I want to** set up notifications for sensor alerts, **so that** I can be informed of critical issues.

**Acceptance Criteria**:

* I can create a notification with a level (yellow, red), trigger (e.g., temperature \> 30°C), delivery method (email or SMS), and recipient(s).  
* I can associate the notification with a sensor type or individual sensor.  
* The system validates notification settings (e.g., valid email/SMS format).  
* Notifications are saved and active immediately.

## **User Story 5.2: Receive Notifications**

**As a** User,  
**I want to** receive notifications for sensor alerts, **so that** I can take action on critical issues.

**Acceptance Criteria**:

* Notifications are sent via email or SMS when a sensor meets the trigger condition.  
* The notification includes sensor details (type, location, reading, alert level).  
* Notifications are delivered within 1 minute of the trigger event.  
* I only receive notifications for sensors I have permission to view.

# EPIC 7: BASIC REPORTING **(Not needed for mvp?)**

**Description**: Provide basic reports for sensor status and system activity to support monitoring and compliance.

## **User Story 6.1: Sensor Status Report**

**As an** Organization Admin or Location Manager,  
**I want to** view a report of sensor statuses, **so that** I can monitor conditions across my locations or departments.

**Acceptance Criteria**:

* I can run a report showing sensor statuses (green, yellow, red) by department or location.  
* The report includes sensor type, location, and current status.  
* The report is accessible only to users with appropriate permissions.  
* The report generates within 5 seconds for up to 100 sensors.

## **User Story 6.2: System Activity Log Report**

**As an** Organization Admin or Technician,  
**I want to** view a report of user activities, **so that** I can audit system usage.

**Acceptance Criteria**:

* I can run a report showing user logins, modifications, and pages viewed (with username, time/date, action).  
* The report is accessible only to Organization Admins (for their tenant) or Technicians (for any tenant).  
* The report generates within 5 seconds for up to 30 days of logs.

# EPIC 8: SYSTEM STABILITY AND USABILITY

**Description**: Ensure the system is stable, performant, and usable for initial deployments.

## **User Story 7.1: System Performance**

**As a** User,  
**I want to** use a system that performs reliably, **so that** I can manage sensors without delays or crashes.

**Acceptance Criteria**:

* The system supports up to 100 sensors per location and 50 users per organization without performance degradation.  *(Maybe smaller for MVP)*  
* Dashboard and map views load within 3 seconds?  
* Sensor data updates in near real-time (within 10 seconds?). Not sure what is possible..  
* The system remains stable under normal usage (e.g., 10 concurrent users).

## **User Story 7.2: Responsive Design**

**As a** User,  
**I want to** access the system on desktop or mobile devices, **so that** I can manage sensors from any device.

**Acceptance Criteria**:

* The dashboard, map view, and menus are usable on desktop and mobile browsers (e.g., Chrome, Safari).  
* Interface elements (e.g., buttons, menus) are accessible and functional on screens from 320px to 1920px wide.  
* Navigation and data entry are intuitive on both device types. *(for MVP maybe we just pick Android?)*

## **~~User Story 7.3: Basic User Documentation~~**

**~~As a~~** ~~User,~~  
**~~I want to~~** ~~access basic documentation,~~  
**~~so that~~** ~~I can learn how to use the system.~~

**~~Acceptance Criteria~~**~~:~~

* ~~A simple user guide (PDF or in-app help) is available, covering login, navigation, sensor management, and notifications.~~  
* ~~The guide is accessible from the dashboard.~~  
* ~~The guide is clear to non-technical users.~~