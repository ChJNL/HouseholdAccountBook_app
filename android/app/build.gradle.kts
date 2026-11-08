plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
providers.gradleProperty("chagokBuildRoot").orNull?.let {
    layout.buildDirectory.set(file("$it/app"))
}

android {
    namespace = "io.chagok.accountbook"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.chagok.accountbook"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "1.0.2"
        testInstrumentationRunner = "io.chagok.accountbook.SmokeInstrumentation"
    }
    buildTypes {
        debug { applicationIdSuffix = ".dev"; versionNameSuffix = "-preview" }
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
}
kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies { implementation("androidx.webkit:webkit:1.14.0") }

val buildWebAssets by tasks.registering(Exec::class) {
    workingDir("../..")
    commandLine(if (System.getProperty("os.name").startsWith("Windows")) "npm.cmd" else "npm", "run", "build")
    inputs.dir("../../web")
    inputs.file("../../scripts/build.mjs")
    inputs.file("../../package.json")
    inputs.file("../../package-lock.json")
    outputs.dir("../../dist")
}
val syncWebAssets by tasks.registering(Sync::class) {
    dependsOn(buildWebAssets)
    from("../../dist")
    into("src/main/assets")
}
tasks.named("preBuild").configure { dependsOn(syncWebAssets) }
