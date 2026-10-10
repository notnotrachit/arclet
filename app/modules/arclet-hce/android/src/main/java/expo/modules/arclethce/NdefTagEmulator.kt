package expo.modules.arclethce

import android.nfc.NdefMessage
import android.nfc.NdefRecord

/**
 * Minimal NFC Forum Type 4 Tag (v2.0) emulator serving a single read-only NDEF message.
 *
 * Reader flow: SELECT NDEF app (AID) -> SELECT CC file (E103) -> READ CC -> SELECT NDEF file (E104)
 * -> READ NLEN (2 bytes) -> READ message (chunked by MLe).
 */
object NdefTagEmulator {
  private val NDEF_AID = hex("D2760000850101")
  private val CC_FILE_ID = hex("E103")
  private val NDEF_FILE_ID = hex("E104")

  private val SW_OK = hex("9000")
  private val SW_NOT_FOUND = hex("6A82")
  private val SW_WRONG_PARAMS = hex("6B00")
  private val SW_WRONG_LENGTH = hex("6700")
  private val SW_INS_NOT_SUPPORTED = hex("6D00")

  const val MAX_NDEF_FILE_SIZE = 0x0400

  // CCLEN=15, mapping v2.0, MLe=0x003B, MLc=0x0034, NDEF File Control TLV(E104, max size, read open, write denied)
  private val CAPABILITY_CONTAINER = byteArrayOf(
    0x00, 0x0F, 0x20, 0x00, 0x3B, 0x00, 0x34,
    0x04, 0x06, 0xE1.toByte(), 0x04,
    (MAX_NDEF_FILE_SIZE shr 8).toByte(), (MAX_NDEF_FILE_SIZE and 0xFF).toByte(),
    0x00, 0xFF.toByte(),
  )

  @Volatile private var ndefFile: ByteArray? = null
  private var appSelected = false
  private var selectedFile: ByteArray? = null

  /** Invoked (on a binder thread) when a reader finishes reading the NDEF message. */
  @Volatile var onRead: (() -> Unit)? = null

  val isActive: Boolean
    get() = ndefFile != null

  /** Sets the URI to serve, or clears it. Throws if the encoded message doesn't fit the tag. */
  @Synchronized
  fun setUri(uri: String?) {
    reset()
    if (uri == null) {
      ndefFile = null
      return
    }
    val message = NdefMessage(NdefRecord.createUri(uri)).toByteArray()
    val file = ByteArray(2 + message.size)
    file[0] = (message.size shr 8).toByte()
    file[1] = (message.size and 0xFF).toByte()
    System.arraycopy(message, 0, file, 2, message.size)
    require(file.size <= MAX_NDEF_FILE_SIZE) { "Payment request too large for NFC (${file.size} bytes)" }
    ndefFile = file
  }

  @Synchronized
  fun reset() {
    appSelected = false
    selectedFile = null
  }

  @Synchronized
  fun process(apdu: ByteArray): ByteArray {
    val ndef = ndefFile ?: return SW_NOT_FOUND
    if (apdu.size < 4) return SW_WRONG_LENGTH

    val ins = apdu[1].toInt() and 0xFF
    val p1 = apdu[2].toInt() and 0xFF
    val p2 = apdu[3].toInt() and 0xFF

    return when (ins) {
      0xA4 -> select(apdu, p1, ndef)
      0xB0 -> readBinary(apdu, p1, p2, ndef)
      else -> SW_INS_NOT_SUPPORTED
    }
  }

  private fun select(apdu: ByteArray, p1: Int, ndef: ByteArray): ByteArray {
    if (apdu.size < 5) return SW_WRONG_LENGTH
    val lc = apdu[4].toInt() and 0xFF
    if (apdu.size < 5 + lc) return SW_WRONG_LENGTH
    val data = apdu.copyOfRange(5, 5 + lc)

    return when (p1) {
      0x04 -> { // select by DF name (AID)
        if (data.contentEquals(NDEF_AID)) {
          appSelected = true
          selectedFile = null
          SW_OK
        } else {
          SW_NOT_FOUND
        }
      }
      0x00 -> { // select by file identifier
        if (!appSelected) return SW_NOT_FOUND
        selectedFile = when {
          data.contentEquals(CC_FILE_ID) -> CAPABILITY_CONTAINER
          data.contentEquals(NDEF_FILE_ID) -> ndef
          else -> null
        }
        if (selectedFile != null) SW_OK else SW_NOT_FOUND
      }
      else -> SW_WRONG_PARAMS
    }
  }

  private fun readBinary(apdu: ByteArray, p1: Int, p2: Int, ndef: ByteArray): ByteArray {
    val file = selectedFile ?: return SW_NOT_FOUND
    val offset = (p1 shl 8) or p2
    if (offset > file.size) return SW_WRONG_PARAMS
    val le = if (apdu.size >= 5) (apdu[4].toInt() and 0xFF).let { if (it == 0) 256 else it } else 256
    val end = minOf(file.size, offset + le)
    val chunk = file.copyOfRange(offset, end)

    // The NLEN-only read (2 bytes at offset 0) doesn't count; the message read reaching the end does.
    if (file === ndef && end == file.size && end > 2) onRead?.invoke()
    return chunk + SW_OK
  }

  private fun hex(s: String): ByteArray =
    ByteArray(s.length / 2) { i -> s.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
}
