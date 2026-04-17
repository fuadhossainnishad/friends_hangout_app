# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ================================
# 🔥 YOUR APP
# ================================
-keep class com.friends_hangout_app.** { *; }

# ================================
# 🔥 ANDROID COMPONENTS
# ================================
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# ================================
# 🔥 REACT NATIVE (CRITICAL)
# ================================
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**

-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.hermes.**

# React Native bridge (VERY IMPORTANT)
-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }

# ================================
# 🔥 FIREBASE (CRITICAL)
# ================================
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# ================================
# 🔥 GOOGLE PLAY SERVICES
# ================================
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ================================
# 🔥 GSON (if used)
# ================================
-keep class com.google.gson.** { *; }
-keep class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# ================================
# 🔥 OKHTTP / RETROFIT (optional)
# ================================
-dontwarn okhttp3.**
-keep class okhttp3.** { *; }

-keep interface retrofit2.** { *; }
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**

# ================================
# 🔥 KOTLIN
# ================================
-keep class kotlin.** { *; }
-dontwarn kotlin.**

# ================================
# 🔥 ANNOTATIONS
# ================================
-keepattributes *Annotation*

# ================================
# 🔥 ENUM SAFETY
# ================================
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ================================
# 🔥 LOG REMOVAL (optional)
# ================================
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
}

# Fix for D8 / play-services-auth crash
-keep class com.google.android.gms.internal.** { *; }
-dontwarn com.google.android.gms.internal.**

# Prevent constructor stripping issue
-keepclassmembers class * {
    <init>(...);
}