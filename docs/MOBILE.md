# Mobile Applications Documentation

## Overview
NetNeural's mobile ecosystem includes native iOS and Android applications for real-time alert management and device monitoring. These applications provide on-the-go access to the NetNeural IoT platform with push notifications, offline capabilities, and native UI experiences.

## Applications

### 📱 iOS Application

#### nn-alerts-ios/ - iOS Alerts Application
**Platform**: iOS (Swift)
**Purpose**: Native iOS application for NetNeural alert management

**Key Features**:
- Real-time push notifications for device alerts
- Native iOS UI with SwiftUI
- Offline alert caching
- Integration with iOS notification system
- Background app refresh for continuous monitoring
- Touch ID/Face ID authentication
- Apple Watch companion app support

**Technology Stack**:
- **Language**: Swift 5.0+
- **UI Framework**: SwiftUI
- **Networking**: URLSession, Combine
- **Database**: Core Data
- **Push Notifications**: APNs (Apple Push Notification service)
- **Authentication**: iOS Keychain Services

**Project Structure**:
```
nn-alerts-ios/
├── NetNeuralAlerts/
│   ├── Models/
│   │   ├── Alert.swift
│   │   ├── Device.swift
│   │   └── User.swift
│   ├── Views/
│   │   ├── AlertListView.swift
│   │   ├── AlertDetailView.swift
│   │   ├── DeviceListView.swift
│   │   └── SettingsView.swift
│   ├── ViewModels/
│   │   ├── AlertViewModel.swift
│   │   └── DeviceViewModel.swift
│   ├── Services/
│   │   ├── APIService.swift
│   │   ├── NotificationService.swift
│   │   └── AuthService.swift
│   └── Utils/
│       ├── Constants.swift
│       └── Extensions.swift
├── NetNeuralAlertsTests/
├── NetNeuralAlertsUITests/
└── Podfile
```

**Key iOS Features**:
```swift
// Push notification registration
func registerForPushNotifications() {
    UNUserNotificationCenter.current().requestAuthorization(
        options: [.alert, .sound, .badge]
    ) { granted, error in
        // Handle authorization
    }
}

// Background app refresh
func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
) {
    // Fetch latest alerts in background
}

// Core Data integration
@Environment(\.managedObjectContext) private var viewContext
@FetchRequest(
    sortDescriptors: [NSSortDescriptor(keyPath: \Alert.timestamp, ascending: false)],
    animation: .default
) private var alerts: FetchedResults<Alert>
```

**Development Setup**:
```bash
cd nn-alerts-ios
# Install CocoaPods dependencies
pod install
# Open workspace in Xcode
open NetNeuralAlerts.xcworkspace
```

---

### 🤖 Android Application

#### Alerts-Android/ - Android Alerts Application
**Platform**: Android (Java/Kotlin)
**Purpose**: Native Android application for NetNeural alert management

**Key Features**:
- Firebase Cloud Messaging (FCM) for push notifications
- Material Design UI components
- Room database for offline storage
- Android Auto integration for vehicle alerts
- Wear OS companion app
- Adaptive icons and themes
- Biometric authentication

**Technology Stack**:
- **Language**: Java/Kotlin
- **UI Framework**: Android Views, Material Components
- **Networking**: Retrofit, OkHttp
- **Database**: Room (SQLite)
- **Push Notifications**: Firebase Cloud Messaging
- **Authentication**: Android Keystore, BiometricPrompt

**Project Structure**:
```
Alerts-Android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/netneural/alerts/
│   │   │   │   ├── activities/
│   │   │   │   │   ├── MainActivity.java
│   │   │   │   │   ├── AlertDetailActivity.java
│   │   │   │   │   └── SettingsActivity.java
│   │   │   │   ├── fragments/
│   │   │   │   │   ├── AlertListFragment.java
│   │   │   │   │   └── DeviceListFragment.java
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── AlertAdapter.java
│   │   │   │   │   └── DeviceAdapter.java
│   │   │   │   ├── models/
│   │   │   │   │   ├── Alert.java
│   │   │   │   │   ├── Device.java
│   │   │   │   │   └── User.java
│   │   │   │   ├── services/
│   │   │   │   │   ├── APIService.java
│   │   │   │   │   ├── FCMService.java
│   │   │   │   │   └── AuthService.java
│   │   │   │   ├── database/
│   │   │   │   │   ├── AlertDao.java
│   │   │   │   │   ├── DeviceDao.java
│   │   │   │   │   └── AppDatabase.java
│   │   │   │   └── utils/
│   │   │   │       ├── Constants.java
│   │   │   │       └── NetworkUtils.java
│   │   │   └── res/
│   │   │       ├── layout/
│   │   │       ├── values/
│   │   │       └── drawable/
│   │   └── test/
│   │   └── androidTest/
│   ├── build.gradle
│   └── proguard-rules.pro
├── gradle/
├── build.gradle
└── settings.gradle
```

**Firebase Integration**:
The Android app includes comprehensive Firebase integration:

```
Alerts-Android/
├── admob/          # AdMob integration samples
├── analytics/      # Firebase Analytics
├── auth/          # Firebase Authentication
├── config/        # Remote Config
├── database/      # Realtime Database
├── dynamiclinks/  # Dynamic Links
├── firestore/     # Cloud Firestore
├── functions/     # Cloud Functions
├── messaging/     # Cloud Messaging (FCM)
├── mlkit/         # ML Kit integration
├── perf/          # Performance monitoring
└── storage/       # Cloud Storage
```

**Key Android Features**:
```java
// Firebase Cloud Messaging
public class FCMService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        // Handle incoming push notifications
        if (remoteMessage.getData().size() > 0) {
            handleDataMessage(remoteMessage.getData());
        }
        
        if (remoteMessage.getNotification() != null) {
            showNotification(remoteMessage.getNotification());
        }
    }
}

// Room database integration
@Entity(tableName = "alerts")
public class Alert {
    @PrimaryKey
    public String id;
    
    @ColumnInfo(name = "device_id")
    public String deviceId;
    
    @ColumnInfo(name = "message")
    public String message;
    
    @ColumnInfo(name = "timestamp")
    public long timestamp;
}

@Dao
public interface AlertDao {
    @Query("SELECT * FROM alerts ORDER BY timestamp DESC")
    LiveData<List<Alert>> getAllAlerts();
    
    @Insert
    void insertAlert(Alert alert);
    
    @Delete
    void deleteAlert(Alert alert);
}
```

**Development Setup**:
```bash
cd Alerts-Android
# Import project in Android Studio
# Sync Gradle files
./gradlew build
```

---

## Architecture & Design Patterns

### iOS Architecture (MVVM)
```swift
// Model
struct Alert: Codable, Identifiable {
    let id: String
    let deviceId: String
    let message: String
    let timestamp: Date
    let severity: AlertSeverity
}

// ViewModel
class AlertViewModel: ObservableObject {
    @Published var alerts: [Alert] = []
    @Published var isLoading = false
    
    private let apiService: APIService
    
    init(apiService: APIService = .shared) {
        self.apiService = apiService
    }
    
    func fetchAlerts() {
        isLoading = true
        apiService.getAlerts { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                switch result {
                case .success(let alerts):
                    self?.alerts = alerts
                case .failure(let error):
                    // Handle error
                    break
                }
            }
        }
    }
}

// View
struct AlertListView: View {
    @StateObject private var viewModel = AlertViewModel()
    
    var body: some View {
        NavigationView {
            List(viewModel.alerts) { alert in
                AlertRowView(alert: alert)
            }
            .navigationTitle("Alerts")
            .onAppear {
                viewModel.fetchAlerts()
            }
        }
    }
}
```

### Android Architecture (MVP/MVVM)
```java
// Model
public class Alert {
    private String id;
    private String deviceId;
    private String message;
    private long timestamp;
    
    // Constructors, getters, setters
}

// Repository
public class AlertRepository {
    private APIService apiService;
    private AlertDao alertDao;
    
    public AlertRepository(APIService apiService, AlertDao alertDao) {
        this.apiService = apiService;
        this.alertDao = alertDao;
    }
    
    public LiveData<List<Alert>> getAlerts() {
        // Return cached data while fetching from API
        fetchAlertsFromAPI();
        return alertDao.getAllAlerts();
    }
    
    private void fetchAlertsFromAPI() {
        apiService.getAlerts().enqueue(new Callback<List<Alert>>() {
            @Override
            public void onResponse(Call<List<Alert>> call, Response<List<Alert>> response) {
                if (response.isSuccessful()) {
                    // Cache in local database
                    new Thread(() -> {
                        alertDao.insertAll(response.body());
                    }).start();
                }
            }
            
            @Override
            public void onFailure(Call<List<Alert>> call, Throwable t) {
                // Handle error
            }
        });
    }
}

// ViewModel
public class AlertViewModel extends ViewModel {
    private AlertRepository repository;
    private LiveData<List<Alert>> alerts;
    
    public AlertViewModel(AlertRepository repository) {
        this.repository = repository;
        this.alerts = repository.getAlerts();
    }
    
    public LiveData<List<Alert>> getAlerts() {
        return alerts;
    }
}
```

## API Integration

### Backend Integration
Both mobile applications integrate with NetNeural's backend services:

#### Authentication Flow
```swift
// iOS - Authentication Service
class AuthService {
    func login(username: String, password: String, completion: @escaping (Result<AuthToken, Error>) -> Void) {
        let request = LoginRequest(username: username, password: password)
        
        APIClient.shared.post("/auth/login", body: request) { (result: Result<AuthResponse, Error>) in
            switch result {
            case .success(let response):
                self.saveToken(response.token)
                completion(.success(response.token))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }
    
    private func saveToken(_ token: AuthToken) {
        let keychain = Keychain(service: "com.netneural.alerts")
        keychain["auth_token"] = token.accessToken
    }
}
```

```java
// Android - Authentication Service
public class AuthService {
    private APIService apiService;
    private SharedPreferences preferences;
    
    public void login(String username, String password, AuthCallback callback) {
        LoginRequest request = new LoginRequest(username, password);
        
        apiService.login(request).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                if (response.isSuccessful()) {
                    saveToken(response.body().getToken());
                    callback.onSuccess(response.body().getToken());
                } else {
                    callback.onError(new AuthException("Login failed"));
                }
            }
            
            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                callback.onError(t);
            }
        });
    }
    
    private void saveToken(String token) {
        preferences.edit().putString("auth_token", token).apply();
    }
}
```

#### Real-time Data Sync
```swift
// iOS - WebSocket connection for real-time updates
class WebSocketService {
    private var webSocket: URLSessionWebSocketTask?
    
    func connect() {
        let url = URL(string: "wss://ws.netneural.com/alerts")!
        webSocket = URLSession.shared.webSocketTask(with: url)
        webSocket?.resume()
        
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    self?.handleData(data)
                @unknown default:
                    break
                }
                self?.receiveMessage() // Continue listening
            case .failure(let error):
                print("WebSocket error: \(error)")
            }
        }
    }
}
```

## Push Notifications

### iOS Push Notifications (APNs)
```swift
// AppDelegate configuration
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    registerForPushNotifications()
    return true
}

func registerForPushNotifications() {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
        guard granted else { return }
        
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

// Handle received notifications
func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let userInfo = response.notification.request.content.userInfo
    
    if let alertId = userInfo["alert_id"] as? String {
        // Navigate to specific alert
        navigateToAlert(alertId)
    }
    
    completionHandler()
}
```

### Android Push Notifications (FCM)
```java
// FCM Service
public class FCMService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        String title = remoteMessage.getNotification().getTitle();
        String body = remoteMessage.getNotification().getBody();
        String alertId = remoteMessage.getData().get("alert_id");
        
        showNotification(title, body, alertId);
    }
    
    private void showNotification(String title, String body, String alertId) {
        Intent intent = new Intent(this, AlertDetailActivity.class);
        intent.putExtra("alert_id", alertId);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT
        );
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true);
        
        NotificationManagerCompat.from(this).notify(alertId.hashCode(), builder.build());
    }
}
```

## Offline Capabilities

### iOS Offline Storage (Core Data)
```swift
// Core Data stack
class PersistenceController {
    static let shared = PersistenceController()
    
    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "AlertModel")
        container.loadPersistentStores { _, error in
            if let error = error {
                fatalError("Core Data error: \(error)")
            }
        }
        return container
    }()
    
    func save() {
        let context = persistentContainer.viewContext
        
        if context.hasChanges {
            try? context.save()
        }
    }
}

// Offline alert caching
class AlertService {
    private let context = PersistenceController.shared.persistentContainer.viewContext
    
    func cacheAlerts(_ alerts: [Alert]) {
        alerts.forEach { alert in
            let cachedAlert = CachedAlert(context: context)
            cachedAlert.id = alert.id
            cachedAlert.message = alert.message
            cachedAlert.timestamp = alert.timestamp
        }
        
        try? context.save()
    }
    
    func getCachedAlerts() -> [Alert] {
        let request: NSFetchRequest<CachedAlert> = CachedAlert.fetchRequest()
        let cachedAlerts = try? context.fetch(request)
        
        return cachedAlerts?.map { cachedAlert in
            Alert(
                id: cachedAlert.id ?? "",
                message: cachedAlert.message ?? "",
                timestamp: cachedAlert.timestamp ?? Date()
            )
        } ?? []
    }
}
```

### Android Offline Storage (Room)
```java
// Room database setup
@Database(entities = {Alert.class, Device.class}, version = 1)
public abstract class AppDatabase extends RoomDatabase {
    public abstract AlertDao alertDao();
    public abstract DeviceDao deviceDao();
    
    private static volatile AppDatabase INSTANCE;
    
    public static AppDatabase getDatabase(final Context context) {
        if (INSTANCE == null) {
            synchronized (AppDatabase.class) {
                if (INSTANCE == null) {
                    INSTANCE = Room.databaseBuilder(
                        context.getApplicationContext(),
                        AppDatabase.class,
                        "netneural_database"
                    ).build();
                }
            }
        }
        return INSTANCE;
    }
}

// Offline-first repository
public class AlertRepository {
    private AlertDao alertDao;
    private APIService apiService;
    
    public LiveData<List<Alert>> getAlerts() {
        // Return cached data immediately
        LiveData<List<Alert>> cachedAlerts = alertDao.getAllAlerts();
        
        // Fetch fresh data in background
        fetchAlertsFromAPI();
        
        return cachedAlerts;
    }
    
    private void fetchAlertsFromAPI() {
        if (NetworkUtils.isNetworkAvailable()) {
            apiService.getAlerts().enqueue(new Callback<List<Alert>>() {
                @Override
                public void onResponse(Call<List<Alert>> call, Response<List<Alert>> response) {
                    if (response.isSuccessful()) {
                        // Update cache
                        new Thread(() -> {
                            alertDao.deleteAll();
                            alertDao.insertAll(response.body());
                        }).start();
                    }
                }
                
                @Override
                public void onFailure(Call<List<Alert>> call, Throwable t) {
                    // Continue using cached data
                }
            });
        }
    }
}
```

## Security Implementation

### iOS Security
```swift
// Biometric authentication
import LocalAuthentication

class BiometricAuthService {
    func authenticateUser(completion: @escaping (Bool, Error?) -> Void) {
        let context = LAContext()
        var error: NSError?
        
        if context.canEvaluatePolicy(.biometryAny, error: &error) {
            context.evaluatePolicy(
                .biometryAny,
                localizedReason: "Authenticate to access alerts"
            ) { success, error in
                DispatchQueue.main.async {
                    completion(success, error)
                }
            }
        } else {
            completion(false, error)
        }
    }
}

// Keychain for secure token storage
import Security

class KeychainService {
    func save(key: String, data: Data) -> OSStatus {
        let query = [
            kSecClass as String: kSecClassGenericPassword as String,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ] as [String: Any]
        
        SecItemDelete(query as CFDictionary)
        return SecItemAdd(query as CFDictionary, nil)
    }
    
    func load(key: String) -> Data? {
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: kCFBooleanTrue!,
            kSecMatchLimit as String: kSecMatchLimitOne
        ] as [String: Any]
        
        var dataTypeRef: AnyObject?
        let status: OSStatus = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == noErr {
            return dataTypeRef as! Data?
        } else {
            return nil
        }
    }
}
```

### Android Security
```java
// Biometric authentication
public class BiometricAuthHelper {
    public void authenticateUser(FragmentActivity activity, BiometricCallback callback) {
        if (BiometricManager.from(activity).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS) {
            
            BiometricPrompt biometricPrompt = new BiometricPrompt(
                (FragmentActivity) activity,
                ContextCompat.getMainExecutor(activity),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        callback.onSuccess();
                    }
                    
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        callback.onError(errString.toString());
                    }
                }
            );
            
            BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Biometric Authentication")
                .setSubtitle("Authenticate to access alerts")
                .setNegativeButtonText("Cancel")
                .build();
                
            biometricPrompt.authenticate(promptInfo);
        }
    }
}

// Encrypted SharedPreferences for secure storage
public class SecureStorage {
    private SharedPreferences encryptedPrefs;
    
    public SecureStorage(Context context) throws Exception {
        MasterKey masterKey = new MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build();
            
        encryptedPrefs = EncryptedSharedPreferences.create(
            context,
            "secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        );
    }
    
    public void saveToken(String token) {
        encryptedPrefs.edit().putString("auth_token", token).apply();
    }
    
    public String getToken() {
        return encryptedPrefs.getString("auth_token", null);
    }
}
```

## Testing Strategies

### iOS Testing
```swift
// Unit tests
class AlertViewModelTests: XCTestCase {
    var viewModel: AlertViewModel!
    var mockAPIService: MockAPIService!
    
    override func setUp() {
        super.setUp()
        mockAPIService = MockAPIService()
        viewModel = AlertViewModel(apiService: mockAPIService)
    }
    
    func testFetchAlertsSuccess() {
        // Given
        let expectedAlerts = [Alert.mock()]
        mockAPIService.alertsToReturn = expectedAlerts
        
        // When
        viewModel.fetchAlerts()
        
        // Then
        XCTAssertEqual(viewModel.alerts, expectedAlerts)
        XCTAssertFalse(viewModel.isLoading)
    }
}

// UI tests
class AlertsUITests: XCTestCase {
    var app: XCUIApplication!
    
    override func setUp() {
        super.setUp()
        app = XCUIApplication()
        app.launch()
    }
    
    func testAlertListNavigation() {
        // Tap on first alert
        app.tables.cells.firstMatch.tap()
        
        // Verify navigation to detail view
        XCTAssertTrue(app.navigationBars["Alert Detail"].exists)
    }
}
```

### Android Testing
```java
// Unit tests
@RunWith(MockitoJUnitRunner.class)
public class AlertRepositoryTest {
    @Mock
    private APIService apiService;
    
    @Mock
    private AlertDao alertDao;
    
    private AlertRepository repository;
    
    @Before
    public void setUp() {
        repository = new AlertRepository(apiService, alertDao);
    }
    
    @Test
    public void testGetAlerts() {
        // Given
        List<Alert> expectedAlerts = Arrays.asList(Alert.mock());
        when(alertDao.getAllAlerts()).thenReturn(new MutableLiveData<>(expectedAlerts));
        
        // When
        LiveData<List<Alert>> result = repository.getAlerts();
        
        // Then
        assertEquals(expectedAlerts, result.getValue());
    }
}

// Instrumented tests
@RunWith(AndroidJUnit4.class)
public class AlertActivityTest {
    @Rule
    public ActivityTestRule<MainActivity> activityRule = new ActivityTestRule<>(MainActivity.class);
    
    @Test
    public void testAlertListDisplay() {
        // Check if RecyclerView is displayed
        onView(withId(R.id.alertRecyclerView))
            .check(matches(isDisplayed()));
            
        // Click on first item
        onView(withId(R.id.alertRecyclerView))
            .perform(RecyclerViewActions.actionOnItemAtPosition(0, click()));
            
        // Verify detail activity is launched
        onView(withId(R.id.alertDetailContainer))
            .check(matches(isDisplayed()));
    }
}
```

## Build & Deployment

### iOS Build Configuration
```swift
// Build configurations in project settings
// Debug configuration
DEVELOPMENT_TEAM = "YOUR_TEAM_ID"
PRODUCT_BUNDLE_IDENTIFIER = "com.netneural.alerts.debug"
CODE_SIGN_STYLE = "Automatic"

// Release configuration  
PRODUCT_BUNDLE_IDENTIFIER = "com.netneural.alerts"
CODE_SIGN_IDENTITY = "iPhone Distribution"
PROVISIONING_PROFILE_SPECIFIER = "NetNeural Alerts Distribution"
```

**Fastlane Configuration**:
```ruby
# Fastfile
default_platform(:ios)

platform :ios do
  desc "Build and upload to TestFlight"
  lane :beta do
    build_app(scheme: "NetNeuralAlerts")
    upload_to_testflight
  end
  
  desc "Build and upload to App Store"
  lane :release do
    build_app(scheme: "NetNeuralAlerts")
    upload_to_app_store
  end
end
```

### Android Build Configuration
```gradle
// app/build.gradle
android {
    compileSdkVersion 34
    
    defaultConfig {
        applicationId "com.netneural.alerts"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    
    buildTypes {
        debug {
            applicationIdSuffix ".debug"
            debuggable true
            buildConfigField "String", "API_BASE_URL", '"https://api-dev.netneural.com"'
        }
        
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            buildConfigField "String", "API_BASE_URL", '"https://api.netneural.com"'
        }
    }
}
```

**Fastlane Configuration**:
```ruby
# Fastfile
default_platform(:android)

platform :android do
  desc "Build and upload to Play Console"
  lane :beta do
    gradle(task: "clean assembleRelease")
    upload_to_play_store(track: 'beta')
  end
  
  desc "Deploy to Play Store"
  lane :release do
    gradle(task: "clean assembleRelease")
    upload_to_play_store(track: 'production')
  end
end
```

## Performance Optimization

### iOS Performance
- **Memory Management**: Use weak references to avoid retain cycles
- **Image Caching**: Implement efficient image loading with SDWebImage
- **Background Processing**: Use background queues for network operations
- **Core Data**: Implement efficient fetch request with predicates and limits

### Android Performance
- **RecyclerView Optimization**: Use ViewHolder pattern and DiffUtil
- **Network Caching**: Implement OkHttp cache for API responses
- **Database Optimization**: Use Room with proper indexing
- **Memory Management**: Use LeakCanary for memory leak detection

## Troubleshooting

### Common iOS Issues
1. **Provisioning Profile**: Ensure correct signing certificates
2. **Push Notifications**: Verify APNs certificates and entitlements
3. **Core Data**: Check data model versions and migration policies
4. **Network Issues**: Implement proper error handling and retry logic

### Common Android Issues
1. **FCM Setup**: Verify google-services.json configuration
2. **Room Database**: Check entity relationships and migration strategies
3. **Permissions**: Ensure proper runtime permission handling
4. **ProGuard**: Configure obfuscation rules for libraries

## Future Enhancements

### Planned Features
- **Apple Watch App**: Companion watchOS application
- **Android Wear**: Wear OS integration
- **Widget Support**: iOS/Android home screen widgets
- **CarPlay/Android Auto**: Vehicle integration
- **Voice Assistant**: Siri/Google Assistant integration

### Technical Improvements
- **SwiftUI/Jetpack Compose**: Modern UI frameworks
- **Combine/RxJava**: Reactive programming
- **GraphQL**: Efficient API queries
- **Machine Learning**: On-device alert classification
