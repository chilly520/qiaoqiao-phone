# ProGuard rules for Chilly Phone
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**

# kotlinx.serialization
-keepclassmembers class **$$serializer { *; }
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-keep,includedescriptorclasses class dev.qiaoqiao.phone.**$$serializer { *; }
-keepclassmembers class dev.qiaoqiao.phone.** {
    *** Companion;
}
-keepclasseswithmembers class dev.qiaoqiao.phone.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# WebView
-keep class android.webkit.** { *; }
