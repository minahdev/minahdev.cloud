import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const PaceApp());
}

class PaceApp extends StatelessWidget {
  const PaceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pace',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF22C55E),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const IntroScreen(),
    );
  }
}

class IntroScreen extends StatefulWidget {
  const IntroScreen({super.key});

  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen>
    with TickerProviderStateMixin {
  static const _primary = Color(0xFF22C55E);
  static const _fg      = Color(0xFF0F0F0F);
  static const _muted   = Color(0xFF5A5A5A);

  late final AnimationController _ctrl;      // content fade + slide (700ms)
  late final AnimationController _iconCtrl;  // bg icons (1200ms)
  late final AnimationController _wordCtrl;  // title cascade (2000ms)
  late final AnimationController _pulseCtrl; // button glow (1500ms, repeat)

  // Logo: scale bounce piggybacked on _ctrl
  late final Animation<double> _logoScale;

  // Icons: slide from corners + fade
  late final List<Animation<Offset>> _iconSlides;
  late final List<Animation<double>> _iconFades;

  // Words: scale + Y-translate (no nested fade — avoids opacity multiplication)
  late final List<Animation<double>> _wordScales;
  late final List<Animation<double>> _wordOffsets;

  // Button shadow glow
  late final Animation<double> _glowAnim;

  @override
  void initState() {
    super.initState();

    _ctrl      = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));
    _iconCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));
    _wordCtrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000));
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500));

    // Logo: easeOutBack gives a confident pop without cartoon bounce
    _logoScale = Tween<double>(begin: 0.75, end: 1.0).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack),
    );

    // Icons: easeOutCubic — smooth, no overshoot, reads as intentional
    _iconSlides = [
      Tween<Offset>(begin: const Offset(1.2, -1.2), end: Offset.zero).animate(
        CurvedAnimation(parent: _iconCtrl, curve: const Interval(0.00, 0.70, curve: Curves.easeOutCubic))),
      Tween<Offset>(begin: const Offset(-1.2, 1.2), end: Offset.zero).animate(
        CurvedAnimation(parent: _iconCtrl, curve: const Interval(0.12, 0.82, curve: Curves.easeOutCubic))),
      Tween<Offset>(begin: const Offset(1.2, 1.2), end: Offset.zero).animate(
        CurvedAnimation(parent: _iconCtrl, curve: const Interval(0.25, 0.95, curve: Curves.easeOutCubic))),
    ];
    _iconFades = [
      Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _iconCtrl, curve: const Interval(0.00, 0.70, curve: Curves.easeOut))),
      Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _iconCtrl, curve: const Interval(0.12, 0.82, curve: Curves.easeOut))),
      Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _iconCtrl, curve: const Interval(0.25, 0.95, curve: Curves.easeOut))),
    ];

    // Words: subtle scale + 14px upward slide, staggered cascade
    final wordIntervals = [
      [0.00, 0.28], // Sync
      [0.10, 0.38], // Your
      [0.20, 0.48], // Mind,
      [0.37, 0.65], // Find
      [0.47, 0.75], // Your
      [0.57, 0.85], // Pace.
    ];
    _wordScales = wordIntervals.map((t) =>
      Tween<double>(begin: 0.82, end: 1.0).animate(
        CurvedAnimation(parent: _wordCtrl, curve: Interval(t[0], t[1], curve: Curves.easeOutBack))),
    ).toList();
    _wordOffsets = wordIntervals.map((t) =>
      Tween<double>(begin: 14.0, end: 0.0).animate(
        CurvedAnimation(parent: _wordCtrl, curve: Interval(t[0], t[1], curve: Curves.easeOut))),
    ).toList();

    // Button glow: animates shadow blurRadius + alpha, not size
    _glowAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    // Orchestrated sequence: icons → content → words → glow
    _iconCtrl.forward();
    Future.delayed(const Duration(milliseconds: 120), () {
      if (!mounted) return;
      _ctrl.forward();
    });
    Future.delayed(const Duration(milliseconds: 450), () {
      if (!mounted) return;
      _wordCtrl.forward();
    });
    Future.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      _pulseCtrl.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _iconCtrl.dispose();
    _wordCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final h  = mq.size.height;
    final w  = mq.size.width;

    final fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    final slideUp = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));

    final logoSize  = w * 0.175;
    final iconSize  = logoSize * 0.52;
    final titleSize = w * 0.095;
    final bodySize  = w * 0.038;

    final titleStyle = TextStyle(
      color: _fg,
      fontSize: titleSize,
      fontWeight: FontWeight.bold,
      height: 1.15,
      letterSpacing: -1.0,
    );

    // Transform.scale + Transform.translate: layout-stable, no opacity multiply
    Widget wordWidget(int idx, String text, {Color? color}) =>
        AnimatedBuilder(
          animation: _wordCtrl,
          builder: (_, child) => Transform.translate(
            offset: Offset(0, _wordOffsets[idx].value),
            child: Transform.scale(
              scale: _wordScales[idx].value,
              child: child,
            ),
          ),
          child: Text(
            text,
            style: color == null ? titleStyle : titleStyle.copyWith(color: color),
          ),
        );

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      extendBodyBehindAppBar: true,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFDFF2E3), Color(0xFFF3FAF4), Color(0xFFE8F5EB)],
          ),
        ),
        child: Stack(
          children: [
            // 동심원 (로고 뒤)
            Positioned(
              top: h * 0.06,
              left: 0,
              right: 0,
              child: Center(
                child: CustomPaint(
                  size: Size(w * 0.78, w * 0.78),
                  painter: _RingsPainter(),
                ),
              ),
            ),

            // 우상단 덤벨 — fade + easeOutCubic slide from top-right
            Positioned(
              top: h * 0.01,
              right: -w * 0.03,
              child: FadeTransition(
                opacity: _iconFades[0],
                child: SlideTransition(
                  position: _iconSlides[0],
                  child: Transform.rotate(
                    angle: -math.pi / 5,
                    child: Icon(Icons.fitness_center, size: w * 0.22, color: _primary.withAlpha(45)),
                  ),
                ),
              ),
            ),

            // 좌하단 자전거 — fade + easeOutCubic slide from bottom-left
            Positioned(
              bottom: h * 0.09,
              left: -w * 0.03,
              child: FadeTransition(
                opacity: _iconFades[1],
                child: SlideTransition(
                  position: _iconSlides[1],
                  child: Icon(Icons.directions_bike, size: w * 0.24, color: _primary.withAlpha(45)),
                ),
              ),
            ),

            // 우하단 덤벨 — fade + easeOutCubic slide from bottom-right
            Positioned(
              bottom: h * 0.13,
              right: -w * 0.02,
              child: FadeTransition(
                opacity: _iconFades[2],
                child: SlideTransition(
                  position: _iconSlides[2],
                  child: Transform.rotate(
                    angle: math.pi / 4,
                    child: Icon(Icons.fitness_center, size: w * 0.18, color: _primary.withAlpha(35)),
                  ),
                ),
              ),
            ),

            // 본문
            SafeArea(
              child: FadeTransition(
                opacity: fade,
                child: SlideTransition(
                  position: slideUp,
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: w * 0.07,
                      vertical: h * 0.01,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        SizedBox(height: h * 0.07),

                        // 로고 — easeOutBack scale: hero moment
                        ScaleTransition(
                          scale: _logoScale,
                          child: Container(
                            width: logoSize,
                            height: logoSize,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(logoSize * 0.3),
                              boxShadow: [
                                BoxShadow(
                                  color: _primary.withAlpha(50),
                                  blurRadius: 28,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: Icon(
                              Icons.monitor_heart_outlined,
                              size: iconSize,
                              color: _primary,
                            ),
                          ),
                        ),

                        SizedBox(height: h * 0.025),

                        // MULTI-SPORT 뱃지
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: w * 0.038,
                            vertical: h * 0.009,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withAlpha(210),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: Colors.black.withAlpha(18)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.directions_run,  size: bodySize * 0.95, color: _fg.withAlpha(160)),
                              SizedBox(width: w * 0.005),
                              Icon(Icons.directions_bike, size: bodySize * 0.95, color: _fg.withAlpha(160)),
                              SizedBox(width: w * 0.015),
                              Icon(Icons.auto_awesome, size: bodySize * 0.85, color: _primary),
                              SizedBox(width: w * 0.01),
                              Text(
                                'MULTI-SPORT',
                                style: TextStyle(
                                  color: _fg.withAlpha(200),
                                  fontSize: bodySize * 0.88,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ],
                          ),
                        ),

                        SizedBox(height: h * 0.022),

                        // 타이틀 — word-by-word cascade
                        Column(
                          children: [
                            Wrap(
                              alignment: WrapAlignment.center,
                              spacing: titleSize * 0.28,
                              children: [
                                wordWidget(0, 'Sync'),
                                wordWidget(1, 'Your'),
                                wordWidget(2, 'Mind,'),
                              ],
                            ),
                            Wrap(
                              alignment: WrapAlignment.center,
                              spacing: titleSize * 0.28,
                              children: [
                                wordWidget(3, 'Find'),
                                wordWidget(4, 'Your'),
                                wordWidget(5, 'Pace.', color: _primary),
                              ],
                            ),
                          ],
                        ),

                        SizedBox(height: h * 0.025),

                        // 자막
                        Text(
                          '의욕 넘치는 아침도, 무기력한 퇴근길도 괜찮습니다.',
                          style: TextStyle(color: _muted, fontSize: bodySize, height: 1.75),
                          textAlign: TextAlign.center,
                        ),
                        RichText(
                          textAlign: TextAlign.center,
                          text: TextSpan(
                            style: TextStyle(color: _muted, fontSize: bodySize, height: 1.75),
                            children: [
                              const TextSpan(text: '오늘의 '),
                              TextSpan(text: '감정', style: TextStyle(color: _fg, fontSize: bodySize, fontWeight: FontWeight.bold)),
                              const TextSpan(text: '과 '),
                              TextSpan(text: '컨디션', style: TextStyle(color: _fg, fontSize: bodySize, fontWeight: FontWeight.bold)),
                              const TextSpan(text: '을 '),
                              TextSpan(text: '분석해', style: TextStyle(color: _fg, fontSize: bodySize, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                        Text(
                          '오직 당신만을 위해 유연하게',
                          style: TextStyle(color: _muted, fontSize: bodySize, height: 1.75),
                          textAlign: TextAlign.center,
                        ),
                        RichText(
                          textAlign: TextAlign.center,
                          text: TextSpan(
                            style: TextStyle(color: _muted, fontSize: bodySize, height: 1.75),
                            children: [
                              const TextSpan(text: '변화하는 '),
                              TextSpan(text: 'AI', style: TextStyle(color: _fg, fontSize: bodySize, fontWeight: FontWeight.bold)),
                              const TextSpan(text: ' 운동 비서 PACE.'),
                            ],
                          ),
                        ),

                        SizedBox(height: h * 0.042),

                        // 시작하기 버튼 — shadow glow pulse (size 고정, 빛만 맥박)
                        AnimatedBuilder(
                          animation: _glowAnim,
                          builder: (_, child) {
                            final t = _glowAnim.value;
                            return Container(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                boxShadow: [
                                  BoxShadow(
                                    color: _primary.withAlpha((30 + 55 * t).round()),
                                    blurRadius: 6 + 22 * t,
                                    spreadRadius: t * 3,
                                    offset: const Offset(0, 3),
                                  ),
                                ],
                              ),
                              child: child,
                            );
                          },
                          child: SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: () {},
                              style: FilledButton.styleFrom(
                                backgroundColor: _primary,
                                padding: EdgeInsets.symmetric(vertical: h * 0.022),
                                shape: const StadiumBorder(),
                                elevation: 0,
                              ),
                              child: Text(
                                '시작하기',
                                style: TextStyle(
                                  fontSize: bodySize * 1.15,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ),

                        SizedBox(height: h * 0.026),

                        // 소셜 로그인
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _socialBtn(w, child: Text('G',
                              style: TextStyle(fontSize: bodySize * 1.1, fontWeight: FontWeight.bold, color: const Color(0xFF4285F4)))),
                            SizedBox(width: w * 0.04),
                            _socialBtn(w, child: Icon(Icons.apple, size: bodySize * 1.5, color: const Color(0xFF1C1C1C))),
                            SizedBox(width: w * 0.04),
                            _socialBtn(w, child: Text('f',
                              style: TextStyle(fontSize: bodySize * 1.25, fontWeight: FontWeight.bold, color: const Color(0xFF1877F2)))),
                          ],
                        ),

                        SizedBox(height: h * 0.022),

                        // 로그인 링크
                        TextButton(
                          onPressed: () {},
                          child: Text(
                            '이미 계정이 있어요  →',
                            style: TextStyle(
                              color: _fg,
                              fontSize: bodySize,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),

                        SizedBox(height: h * 0.03),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _socialBtn(double w, {required Widget child}) => Container(
        width: w * 0.125,
        height: w * 0.125,
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(200),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.black.withAlpha(18)),
        ),
        child: Center(child: child),
      );
}

class _RingsPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF22C55E).withAlpha(28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;

    final center = Offset(size.width / 2, size.height / 2);
    final step   = size.width / 14;
    for (int i = 1; i <= 7; i++) {
      canvas.drawCircle(center, step * i, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
