package io.chagok.accountbook

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.view.WindowInsets
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

class MainActivity : Activity() {
    lateinit var webView: WebView
        private set
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingExport: String? = null
    private val origin = "https://appassets.androidplatform.net"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(246, 247, 244))
        setContentView(webView)
        webView.setOnApplyWindowInsetsListener { view, insets ->
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            } else {
                @Suppress("DEPRECATION")
                view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            setGeolocationEnabled(false)
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                if (!isLocal(request.url)) return blockedResponse()
                return loader.shouldInterceptRequest(request.url) ?: blockedResponse()
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = !isLocal(request.url)
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                    }, IMPORT_FILE)
                    true
                } catch (_: Exception) {
                    fileCallback?.onReceiveValue(null); fileCallback = null
                    Toast.makeText(this@MainActivity, "파일 선택기를 열지 못했습니다.", Toast.LENGTH_LONG).show()
                    false
                }
            }
        }
        webView.addJavascriptInterface(BackupBridge(), "AndroidFiles")
        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        if (webView.url == null) webView.loadUrl("$origin/assets/index.html")
    }

    private fun isLocal(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "appassets.androidplatform.net" && uri.port == -1 && uri.path.orEmpty().startsWith("/assets/")
    private fun blockedResponse() = WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", emptyMap(), ByteArrayInputStream("외부 연결을 허용하지 않습니다.".toByteArray()))

    inner class BackupBridge {
        @JavascriptInterface
        fun saveJson(json: String, filename: String) {
            if (json.length > 10 * 1024 * 1024) return
            runOnUiThread {
                if (pendingExport != null) {
                    Toast.makeText(this@MainActivity, "진행 중인 파일 저장을 먼저 완료해 주세요.", Toast.LENGTH_SHORT).show()
                    return@runOnUiThread
                }
                pendingExport = json
                try {
                    startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/json"
                        putExtra(Intent.EXTRA_TITLE, filename.take(100).replace('/', '-').replace('\\', '-'))
                    }, EXPORT_FILE)
                } catch (_: Exception) {
                    pendingExport = null
                    Toast.makeText(this@MainActivity, "파일 저장 화면을 열지 못했습니다.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    @Deprecated("기본 Activity 파일 선택 결과 처리")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == IMPORT_FILE) {
            val uri = if (resultCode == RESULT_OK) data?.data else null
            fileCallback?.onReceiveValue(uri?.let { arrayOf(it) })
            fileCallback = null
        }
        if (requestCode == EXPORT_FILE) {
            val json = pendingExport; pendingExport = null
            if (resultCode != RESULT_OK || json == null) return
            val uri = data?.data ?: return
            Thread {
                val success = runCatching {
                    val stream = contentResolver.openOutputStream(uri, "wt") ?: error("파일을 열 수 없습니다.")
                    stream.bufferedWriter(Charsets.UTF_8).use { it.write(json) }
                }.isSuccess
                runOnUiThread { Toast.makeText(this, if (success) "백업 파일을 저장했습니다." else "백업 파일을 저장하지 못했습니다.", Toast.LENGTH_LONG).show() }
            }.start()
        }
    }

    override fun onSaveInstanceState(outState: Bundle) { webView.saveState(outState); super.onSaveInstanceState(outState) }
    @Deprecated("웹 화면 뒤로 이동 처리")
    override fun onBackPressed() {
        webView.evaluateJavascript("(() => { const modal = document.querySelector('dialog[open]'); if (modal) { modal.close(); return 'handled'; } if (document.body.classList.contains('sidebar-open')) { document.querySelector('#menu-toggle').click(); return 'handled'; } if (location.hash && location.hash !== '#dashboard') { location.hash='dashboard'; return 'handled'; } return 'exit'; })()") { result ->
            if (result == "\"exit\"") finish()
        }
    }
    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        webView.removeJavascriptInterface("AndroidFiles")
        webView.destroy()
        super.onDestroy()
    }
    companion object { private const val IMPORT_FILE = 10; private const val EXPORT_FILE = 11 }
}
