package io.chagok.accountbook

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.os.Bundle
import org.json.JSONTokener
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** 앱에 포함한 실제 웹 화면에서 입력·저장·반응형 동작을 검증한다. */
class SmokeInstrumentation : Instrumentation() {
    private lateinit var activity: MainActivity
    private fun evaluate(script: String): String {
        val latch = CountDownLatch(1)
        var value = "null"
        runOnMainSync { activity.webView.evaluateJavascript(script) { result -> value = result; latch.countDown() } }
        check(latch.await(10, TimeUnit.SECONDS)) { "웹 화면 응답 시간이 초과되었습니다." }
        return if (value == "null") "null" else JSONTokener(value).nextValue().toString()
    }
    override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }
    override fun onStart() {
        val results = Bundle()
        try {
            activity = startActivitySync(Intent(targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) as MainActivity
            val deadline = System.currentTimeMillis() + 30_000
            while (System.currentTimeMillis() < deadline && evaluate("document.querySelector('#view')?.textContent?.includes('오늘') || false") != "true") Thread.sleep(200)
            val script = context.assets.open("smoke.js").bufferedReader().use { it.readText() }
            evaluate(script)
            val testDeadline = System.currentTimeMillis() + 120_000
            var status = "pending"
            while (System.currentTimeMillis() < testDeadline) {
                status = evaluate("window.__smokeResult || 'pending'")
                if (status != "pending") break
                Thread.sleep(150)
            }
            check(status.startsWith("통과")) { status }
            results.putString("stream", "\n$status\n")
            finish(Activity.RESULT_OK, results)
        } catch (error: Throwable) {
            results.putString("stream", "\n검증 실패: ${error.message}\n")
            finish(Activity.RESULT_CANCELED, results)
        }
    }
}
