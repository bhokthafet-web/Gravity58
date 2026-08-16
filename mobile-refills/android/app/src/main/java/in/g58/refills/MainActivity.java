package in.g58.refills;

import android.content.Intent;
import android.net.Uri;
import android.nfc.NfcAdapter;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    String url = incomingLinkUrl(getIntent());
    if (url == null) return;
    // On a cold start the bridge's WebView is still navigating to its
    // configured server.url; applying the deep link immediately can lose
    // that race and silently get overwritten. Apply it now and once more
    // shortly after so it reliably wins regardless of timing.
    loadUrlIfReady(url);
    new Handler(Looper.getMainLooper()).postDelayed(() -> loadUrlIfReady(url), 600);
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    String url = incomingLinkUrl(intent);
    if (url != null) loadUrlIfReady(url);
  }

  private String incomingLinkUrl(Intent intent) {
    if (intent == null) return null;
    String action = intent.getAction();
    boolean isLink = Intent.ACTION_VIEW.equals(action);
    boolean isNfcTag = NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)
      || NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)
      || NfcAdapter.ACTION_TAG_DISCOVERED.equals(action);
    if (!isLink && !isNfcTag) return null;
    Uri uri = intent.getData();
    return uri != null ? uri.toString() : null;
  }

  private void loadUrlIfReady(String url) {
    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().loadUrl(url);
    }
  }
}
