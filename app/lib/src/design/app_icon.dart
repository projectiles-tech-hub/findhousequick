import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'icons.g.dart';
import 'tokens.dart';

export 'icons.g.dart' show AppIcons;

String _hex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// One of the app's own icons (decision 68), as drawn in the design file.
///
/// [cut] is the colour behind the icon; filled icons use it for the details cut out of their shape.
class AppIcon extends StatelessWidget {
  const AppIcon(this.icon, {super.key, this.size = 24, this.color = AppColors.ink900, this.cut = AppColors.surface, this.label});

  final AppIcons icon;
  final double size;
  final Color color;
  final Color cut;

  /// Read out by screen readers. Leave empty when the icon sits beside words that say the same thing.
  final String? label;

  @override
  Widget build(BuildContext context) {
    final shapes = appIconShapes[icon]!.replaceAll('{c}', _hex(color)).replaceAll('{k}', _hex(cut));
    return SvgPicture.string(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">$shapes</svg>',
      width: size,
      height: size,
      semanticsLabel: label,
      excludeFromSemantics: label == null,
    );
  }
}
