package in.g58.refills;

import android.content.Intent;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    loadIncomingLink(getIntent());
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    loadIncomingLink(intent);
  }

  private void loadIncomingLink(Intent intent) {
    if (intent == null) return;
    String action = intent.getAction();
    boolean isLink = Intent.ACTION_VIEW.equals(action);
    boolean isNfcTag = NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)
      || NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)
      || NfcAdapter.ACTION_TAG_DISCOVERED.equals(action);
    if (!isLink && !isNfcTag) return;
    Uri uri = intent.getData();
    if (uri == null) return;
    String url = uri.toString();
    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().loadUrl(url);
    }
  }
}
