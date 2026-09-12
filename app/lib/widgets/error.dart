import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import '../api/api.dart';
import '../theme/tokens.dart';

// Human-friendly error card — network down vs server error vs action failure.
// ponytail: no connectivity_plus dep — classify by exception type; add real connectivity check if offline UX matters more.
class SajiError extends StatelessWidget {
  final Object error;
  final VoidCallback? onRetry;
  const SajiError({super.key, required this.error, this.onRetry});

  String get _title {
    if (error is SocketException || error is TimeoutException || error is HttpException) {
      return 'Server nggak bisa dijangkau';
    }
    if (error is ApiException) {
      final e = error as ApiException;
      if (e.status == 401) return 'Sesi habis, login ulang ya';
      if (e.status == 403) return e.message;
      if (e.status >= 500) return 'Server lagi bermasalah';
      return e.message;
    }
    return 'Ada yang error';
  }

  String get _detail {
    if (error is SocketException || error is TimeoutException || error is HttpException) {
      return 'Cek koneksi internet kamu, atau API lagi down. Coba lagi sebentar.';
    }
    if (error is ApiException) {
      final e = error as ApiException;
      if (e.status == 401 || e.status == 403) return '';
      if (e.status >= 500) return 'Tim kami lagi beresin. Coba lagi nanti.';
      return '';
    }
    return error.toString();
  }

  IconData get _icon {
    if (error is SocketException || error is TimeoutException || error is HttpException) {
      return Icons.cloud_off_outlined;
    }
    if (error is ApiException && (error as ApiException).status >= 500) return Icons.dns_outlined;
    return Icons.error_outline;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SajiSpace.s4),
      decoration: BoxDecoration(
        color: SajiColors.lightSurface,
        border: Border.all(color: SajiColors.danger.withOpacity(0.3)),
        borderRadius: BorderRadius.circular(SajiRadius.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(_icon, color: SajiColors.danger, size: 22),
          const SizedBox(width: SajiSpace.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: SajiColors.brown900)),
                if (_detail.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(_detail, style: SajiText.bodySm),
                ],
              ],
            ),
          ),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Coba lagi')),
        ],
      ),
    );
  }
}

// Quick snackbar for action failures (non-blocking)
void showSajiError(BuildContext context, Object error) {
  final msg = error is ApiException
      ? (error as ApiException).message
      : (error is SocketException || error is TimeoutException)
          ? 'Server nggak bisa dijangkau — cek koneksi'
          : 'Ada yang error, coba lagi';
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(msg),
    backgroundColor: SajiColors.danger,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
  ));
}
