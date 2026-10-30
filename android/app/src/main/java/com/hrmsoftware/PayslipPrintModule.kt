package com.hrmsoftware

import android.content.Context
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Renders HTML off-screen in a WebView and hands it to Android's print
 * framework, so the system dialog can print or save a PDF.
 */
class PayslipPrintModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName(): String = "PayslipPrint"

  @ReactMethod
  fun printHtml(html: String, jobName: String, promise: Promise) {
    val activity = getCurrentActivity()
    if (activity == null) {
      promise.reject("no_activity", "No screen is available to print from.")
      return
    }

    activity.runOnUiThread {
      try {
        val webView = WebView(activity)
        webView.settings.javaScriptEnabled = false
        webView.webViewClient = object : WebViewClient() {
          override fun onPageFinished(view: WebView, url: String?) {
            try {
              val printManager =
                activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
              val adapter = view.createPrintDocumentAdapter(jobName)
              val wrapped = object : PrintDocumentAdapter() {
                override fun onStart() {
                  adapter.onStart()
                }

                override fun onLayout(
                  oldAttributes: PrintAttributes?,
                  newAttributes: PrintAttributes?,
                  cancellationSignal: CancellationSignal?,
                  callback: PrintDocumentAdapter.LayoutResultCallback?,
                  extras: Bundle?,
                ) {
                  adapter.onLayout(
                    oldAttributes,
                    newAttributes,
                    cancellationSignal,
                    callback,
                    extras,
                  )
                }

                override fun onWrite(
                  pages: Array<out PageRange>?,
                  destination: ParcelFileDescriptor?,
                  cancellationSignal: CancellationSignal?,
                  callback: PrintDocumentAdapter.WriteResultCallback?,
                ) {
                  adapter.onWrite(pages, destination, cancellationSignal, callback)
                }

                override fun onFinish() {
                  adapter.onFinish()
                  view.destroy()
                }
              }
              printManager.print(
                jobName,
                wrapped,
                PrintAttributes.Builder()
                  .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                  .build(),
              )
              promise.resolve(true)
            } catch (error: Exception) {
              view.destroy()
              promise.reject("print_failed", error)
            }
          }
        }
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
      } catch (error: Exception) {
        promise.reject("print_failed", error)
      }
    }
  }
}
