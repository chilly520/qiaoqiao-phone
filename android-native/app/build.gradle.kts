// app/build.gradle.kts
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "dev.qiaoqiao.phone"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.qiaoqiao.phone"
        minSdk = 24
        targetSdk = 34
        // v1.10.232: 占位符, CI workflow (build-native-apk.yml) 会从 src/version.json 动态同步
        // 之前硬编码 216 一直没动, 导致所有 native APK 元数据停留在 1.10.216, 跟 src/version.json 脱钩
        versionCode = 0
        versionName = "0.0.0"

        // Cloudflare Pages 上 PWA 的 URL
        buildConfigField("String", "PWA_URL", "\"https://qiaqiao-phone.pages.dev\"")
    }

    signingConfigs {
        create("release") {
            // CI 通过命令行传入: android-native/android.keystore (从 Secrets 解出来)
            val keystorePath = System.getenv("KEYSTORE_PATH") ?: "android.keystore"
            val storePass = System.getenv("KEYSTORE_PASSWORD") ?: "android"
            val keyAliasValue = System.getenv("KEY_ALIAS") ?: "android"
            val keyPass = System.getenv("KEY_PASSWORD") ?: "android"
            storeFile = file(keystorePath)
            storePassword = storePass
            keyAlias = keyAliasValue
            keyPassword = keyPass
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        getByName("debug") {
            applicationIdSuffix = ".debug"
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.lifecycle:lifecycle-service:2.7.0")
    implementation("androidx.webkit:webkit:1.10.0")
    implementation("com.google.android.material:material:1.11.0")

    // OkHttp + 序列化
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")

    // 协程
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
