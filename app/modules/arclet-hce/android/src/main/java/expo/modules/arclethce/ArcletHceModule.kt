package expo.modules.arclethce

import android.app.Activity
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Receive-side NFC control.
 *
 * While broadcasting:
 *  1. ArcletCardService is enabled and answers readers with the payment request (Type 4 NDEF tag).
 *  2. Foreground dispatch is enabled with a catch-all filter so this phone's own NFC reader doesn't
 *     pop the system "New tag scanned / unknown tag type" screen when it detects the payer's phone.
 *     Foreground dispatch (unlike reader mode) keeps card emulation running.
 *
 * When not broadcasting the service component is disabled, so the phone doesn't look like an Arclet
 * tag to other readers (including another Arclet user's receiving phone).
 */
class ArcletHceModule : Module() {
  @Volatile private var broadcasting = false

  override fun definition() = ModuleDefinition {
    Name("ArcletHce")

    Events("onTagRead")

    OnCreate {
      NdefTagEmulator.onRead = { sendEvent("onTagRead", mapOf<String, Any?>()) }
      // Clean up a stale enabled state if the process died while broadcasting.
      setServiceEnabled(false)
    }

    OnDestroy {
      NdefTagEmulator.onRead = null
      NdefTagEmulator.setUri(null)
      setServiceEnabled(false)
    }

    OnActivityEntersForeground {
      if (broadcasting) appContext.currentActivity?.let { enableTagSwallowing(it) }
    }

    OnActivityEntersBackground {
      appContext.currentActivity?.let { disableTagSwallowing(it) }
    }

    Function("isSupported") {
      val pm = appContext.reactContext?.packageManager ?: return@Function false
      pm.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)
    }

    Function("isNfcEnabled") {
      val ctx = appContext.reactContext ?: return@Function false
      NfcAdapter.getDefaultAdapter(ctx)?.isEnabled == true
    }

    AsyncFunction("start") { uri: String, promise: Promise ->
      try {
        NdefTagEmulator.setUri(uri)
        setServiceEnabled(true)
        broadcasting = true
        appContext.currentActivity?.let {
          setPreferred(it, true)
          enableTagSwallowing(it)
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_HCE_START", e.message ?: "Failed to start NFC broadcast", e)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      broadcasting = false
      NdefTagEmulator.setUri(null)
      appContext.currentActivity?.let {
        setPreferred(it, false)
        disableTagSwallowing(it)
      }
      setServiceEnabled(false)
    }.runOnQueue(Queues.MAIN)
  }

  private fun setServiceEnabled(enabled: Boolean) {
    val ctx = appContext.reactContext ?: return
    val state =
      if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
    try {
      ctx.packageManager.setComponentEnabledSetting(
        ComponentName(ctx, ArcletCardService::class.java),
        state,
        PackageManager.DONT_KILL_APP,
      )
    } catch (_: Exception) {
      // Ignore: worst case the service stays in its previous state and answers "not found".
    }
  }

  /** While receiving, ask Android to prefer our service if another app registered the same NDEF AID. */
  private fun setPreferred(activity: Activity, on: Boolean) {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return
    try {
      val ce = CardEmulation.getInstance(adapter)
      if (on) {
        ce.setPreferredService(activity, ComponentName(activity, ArcletCardService::class.java))
      } else {
        ce.unsetPreferredService(activity)
      }
    } catch (_: Exception) {
      // Best effort: emulation still works without preference when there is no AID conflict.
    }
  }

  /**
   * Routes every tag this phone's reader sees back to our own activity (where nothing handles it),
   * instead of the system tag viewer. Must be called while the activity is resumed.
   */
  private fun enableTagSwallowing(activity: Activity) {
    val adapter = NfcAdapter.getDefaultAdapter(activity) ?: return
    val intent = Intent(activity, activity.javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
    val pending = PendingIntent.getActivity(activity, 0x4152, intent, flags)
    try {
      adapter.enableForegroundDispatch(activity, pending, null, null)
    } catch (_: Exception) {
      // Activity not resumed yet; OnActivityEntersForeground will retry.
    }
  }

  private fun disableTagSwallowing(activity: Activity) {
    try {
      NfcAdapter.getDefaultAdapter(activity)?.disableForegroundDispatch(activity)
    } catch (_: Exception) {
      // Not enabled or activity already paused.
    }
  }
}
