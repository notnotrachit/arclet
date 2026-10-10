package expo.modules.arclethce

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/** Android routes APDUs for our AID here while the app is installed; the emulator decides what to answer. */
class ArcletCardService : HostApduService() {
  override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray =
    NdefTagEmulator.process(commandApdu ?: ByteArray(0))

  override fun onDeactivated(reason: Int) {
    NdefTagEmulator.reset()
  }
}
