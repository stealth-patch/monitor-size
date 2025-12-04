// 모니터 데이터 정의
const MONITORS = {
  '16:9': [
    { size: 32, label: '32인치' },
    { size: 27, label: '27인치' },
    { size: 24, label: '24인치' },
    { size: 22, label: '22인치' },
    { size: 21.5, label: '21.5인치' },
    { size: 19, label: '19인치' }
  ],
  '21:9': [
    { size: 34, label: '34인치' },
    { size: 29, label: '29인치' }
  ]
};

// 색상 매핑
const COLORS = {
  32: 'var(--color-32)',
  27: 'var(--color-27)',
  24: 'var(--color-24)',
  22: 'var(--color-22)',
  21.5: 'var(--color-21-5)',
  19: 'var(--color-19)',
  34: 'var(--color-34)',
  29: 'var(--color-29)'
};

// 상태 관리
const state = {
  myMonitor: { size: 32, ratio: '16:9' },
  compareMonitors: [],
  overlayPositions: {} // 각 오버레이의 위치 저장
};

// DOM 요소
const elements = {
  myMonitorSelect: document.getElementById('myMonitor'),
  compareOptions: document.getElementById('compareOptions'),
  resetBtn: document.getElementById('resetBtn'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  immersiveBtn: document.getElementById('immersiveBtn'),
  visualArea: document.getElementById('visualArea'),
  overlayContainer: document.getElementById('overlayContainer'),
  myMonitorLabel: document.getElementById('myMonitorLabel'),
  monitorInfo: document.getElementById('monitorInfo'),
  app: document.getElementById('app')
};

// 모니터 물리적 크기 계산 (인치)
function calculateDimensions(diagonalInches, aspectRatio) {
  const [w, h] = aspectRatio.split(':').map(Number);
  const diagonal = Math.sqrt(w * w + h * h);
  const width = (diagonalInches * w) / diagonal;
  const height = (diagonalInches * h) / diagonal;
  return { width, height };
}

// 인치를 센티미터로 변환
function inchToCm(inches) {
  return inches * 2.54;
}

// 비교 모니터의 비율 계산
function calculateRatio(targetSize, targetRatio, baseSize, baseRatio) {
  const targetDim = calculateDimensions(targetSize, targetRatio);
  const baseDim = calculateDimensions(baseSize, baseRatio);

  // 같은 비율이면 단순 크기 비율
  if (targetRatio === baseRatio) {
    return targetSize / baseSize;
  }

  // 다른 비율이면 가로 기준으로 계산
  return targetDim.width / baseDim.width;
}

// CSS 클래스용 크기 문자열 생성
function getSizeClass(size) {
  return String(size).replace('.', '-');
}

// 비교 옵션 체크박스 생성
function createCompareOptions() {
  const container = elements.compareOptions;
  container.innerHTML = '';

  const mySize = state.myMonitor.size;
  const myRatio = state.myMonitor.ratio;

  // 같은 비율의 더 작은 모니터들
  const sameRatioMonitors = MONITORS[myRatio].filter(m => m.size < mySize);

  // 다른 비율의 모니터들 (현재 모니터보다 작은 것만)
  const otherRatio = myRatio === '16:9' ? '21:9' : '16:9';
  const otherRatioMonitors = MONITORS[otherRatio].filter(m => {
    const ratio = calculateRatio(m.size, otherRatio, mySize, myRatio);
    return ratio < 1;
  });

  const allMonitors = [
    ...sameRatioMonitors.map(m => ({ ...m, ratio: myRatio })),
    ...otherRatioMonitors.map(m => ({ ...m, ratio: otherRatio }))
  ];

  allMonitors.forEach(monitor => {
    const id = `compare-${monitor.size}-${monitor.ratio.replace(':', '-')}`;
    const sizeClass = getSizeClass(monitor.size);

    const item = document.createElement('label');
    item.className = 'checkbox-item';
    item.innerHTML = `
      <input type="checkbox" id="${id}"
             data-size="${monitor.size}"
             data-ratio="${monitor.ratio}">
      <span class="color-dot color-${sizeClass}"></span>
      <span>${monitor.label}${monitor.ratio !== myRatio ? ` (${monitor.ratio})` : ''}</span>
    `;

    container.appendChild(item);

    // 이벤트 리스너
    item.querySelector('input').addEventListener('change', handleCompareChange);
  });
}

// 비교 모니터 선택 변경 핸들러
function handleCompareChange(e) {
  const checkbox = e.target;
  const size = parseFloat(checkbox.dataset.size);
  const ratio = checkbox.dataset.ratio;
  const key = `${size}-${ratio}`;

  if (checkbox.checked) {
    if (!state.compareMonitors.find(m => m.key === key)) {
      state.compareMonitors.push({ size, ratio, key });
    }
  } else {
    state.compareMonitors = state.compareMonitors.filter(m => m.key !== key);
    delete state.overlayPositions[key];
  }

  renderOverlays();
  updateInfoPanel();
}

// 내 모니터 선택 변경 핸들러
function handleMyMonitorChange(e) {
  const value = e.target.value;
  const [size, ratio] = value.split('-');
  state.myMonitor = {
    size: parseFloat(size),
    ratio: ratio
  };

  // 비교 모니터 초기화
  state.compareMonitors = [];
  state.overlayPositions = {};

  createCompareOptions();
  renderOverlays();
  updateMyMonitorLabel();
  updateInfoPanel();
}

// 오버레이 렌더링
function renderOverlays() {
  const container = elements.overlayContainer;
  container.innerHTML = '';

  const visualArea = elements.visualArea;
  const areaWidth = visualArea.clientWidth;
  const areaHeight = visualArea.clientHeight;

  state.compareMonitors.forEach((monitor, index) => {
    const ratio = calculateRatio(
      monitor.size,
      monitor.ratio,
      state.myMonitor.size,
      state.myMonitor.ratio
    );

    // 오버레이 크기 계산
    let overlayWidth, overlayHeight;

    if (monitor.ratio === state.myMonitor.ratio) {
      // 같은 비율: 단순 스케일
      overlayWidth = areaWidth * ratio;
      overlayHeight = areaHeight * ratio;
    } else {
      // 다른 비율: 가로 기준으로 계산 후 비율에 맞게 높이 조정
      const targetDim = calculateDimensions(monitor.size, monitor.ratio);
      const baseDim = calculateDimensions(state.myMonitor.size, state.myMonitor.ratio);

      overlayWidth = areaWidth * (targetDim.width / baseDim.width);
      overlayHeight = areaHeight * (targetDim.height / baseDim.height);
    }

    // 저장된 위치 또는 중앙 기본값
    const savedPos = state.overlayPositions[monitor.key];
    const left = savedPos ? savedPos.left : (areaWidth - overlayWidth) / 2;
    const top = savedPos ? savedPos.top : (areaHeight - overlayHeight) / 2;

    const sizeClass = getSizeClass(monitor.size);
    const dimensions = calculateDimensions(monitor.size, monitor.ratio);
    const percentRatio = (ratio * 100).toFixed(1);

    const overlay = document.createElement('div');
    overlay.className = `monitor-overlay border-${sizeClass}`;
    overlay.style.width = `${overlayWidth}px`;
    overlay.style.height = `${overlayHeight}px`;
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.zIndex = 10 + index;
    overlay.dataset.key = monitor.key;

    overlay.innerHTML = `
      <span class="overlay-label text-${sizeClass}">
        ${MONITORS[monitor.ratio].find(m => m.size === monitor.size).label}
        ${monitor.ratio !== state.myMonitor.ratio ? ` (${monitor.ratio})` : ''}
      </span>
      <span class="overlay-ratio text-${sizeClass}">${percentRatio}%</span>
      <span class="overlay-info">
        ${dimensions.width.toFixed(1)}" × ${dimensions.height.toFixed(1)}"
        (${inchToCm(dimensions.width).toFixed(1)}cm × ${inchToCm(dimensions.height).toFixed(1)}cm)
      </span>
    `;

    // 드래그 기능 추가
    makeDraggable(overlay, monitor.key);

    container.appendChild(overlay);
  });
}

// 드래그 기능
function makeDraggable(element, key) {
  let isDragging = false;
  let startX, startY;
  let initialLeft, initialTop;

  const onMouseDown = (e) => {
    if (e.target !== element && !element.contains(e.target)) return;

    isDragging = true;
    element.classList.add('dragging');

    startX = e.clientX || e.touches[0].clientX;
    startY = e.clientY || e.touches[0].clientY;
    initialLeft = element.offsetLeft;
    initialTop = element.offsetTop;

    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;

    const currentX = e.clientX || e.touches[0].clientX;
    const currentY = e.clientY || e.touches[0].clientY;

    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    const newLeft = initialLeft + deltaX;
    const newTop = initialTop + deltaY;

    element.style.left = `${newLeft}px`;
    element.style.top = `${newTop}px`;
  };

  const onMouseUp = () => {
    if (!isDragging) return;

    isDragging = false;
    element.classList.remove('dragging');

    // 위치 저장
    state.overlayPositions[key] = {
      left: element.offsetLeft,
      top: element.offsetTop
    };
  };

  // 마우스 이벤트
  element.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // 터치 이벤트
  element.addEventListener('touchstart', onMouseDown, { passive: false });
  document.addEventListener('touchmove', onMouseMove, { passive: false });
  document.addEventListener('touchend', onMouseUp);
}

// 내 모니터 레이블 업데이트
function updateMyMonitorLabel() {
  const label = elements.myMonitorLabel;
  const dimensions = calculateDimensions(state.myMonitor.size, state.myMonitor.ratio);

  label.querySelector('.size').textContent =
    `${state.myMonitor.size}인치 (${state.myMonitor.ratio})`;
  label.querySelector('.dimensions').textContent =
    `${dimensions.width.toFixed(1)}" × ${dimensions.height.toFixed(1)}" ` +
    `(${inchToCm(dimensions.width).toFixed(1)}cm × ${inchToCm(dimensions.height).toFixed(1)}cm)`;
}

// 정보 패널 업데이트
function updateInfoPanel() {
  const container = elements.monitorInfo;

  if (state.compareMonitors.length === 0) {
    container.innerHTML = '<span style="color: var(--text-secondary)">비교할 모니터를 선택하세요</span>';
    return;
  }

  container.innerHTML = state.compareMonitors.map(monitor => {
    const sizeClass = getSizeClass(monitor.size);
    const dimensions = calculateDimensions(monitor.size, monitor.ratio);
    const ratio = calculateRatio(
      monitor.size,
      monitor.ratio,
      state.myMonitor.size,
      state.myMonitor.ratio
    );
    const percentRatio = (ratio * 100).toFixed(1);
    const monitorData = MONITORS[monitor.ratio].find(m => m.size === monitor.size);

    return `
      <div class="info-item">
        <span class="color-indicator color-${sizeClass}"></span>
        <span class="info-text">${monitorData.label}:</span>
        <span class="info-value">${percentRatio}%</span>
        <span class="info-text">
          (${dimensions.width.toFixed(1)}" × ${dimensions.height.toFixed(1)}")
        </span>
      </div>
    `;
  }).join('');
}

// 위치 초기화
function resetPositions() {
  state.overlayPositions = {};
  renderOverlays();
}

// 전체 화면 토글
function toggleFullscreen() {
  elements.app.classList.toggle('fullscreen');

  const isFullscreen = elements.app.classList.contains('fullscreen');
  elements.fullscreenBtn.innerHTML = isFullscreen
    ? '<span class="icon">⛶</span> 창 모드'
    : '<span class="icon">⛶</span> 전체 화면';

  // 크기가 변경되므로 오버레이 다시 렌더링
  setTimeout(() => {
    renderOverlays();
  }, 300);
}

// 몰입 모드 토글 (패널 숨기기)
function toggleImmersive() {
  elements.app.classList.toggle('immersive');

  const isImmersive = elements.app.classList.contains('immersive');
  elements.immersiveBtn.innerHTML = isImmersive
    ? '<span class="icon">◳</span>'
    : '<span class="icon">◱</span>';
  elements.immersiveBtn.title = isImmersive ? '패널 보이기 (I키)' : '패널 숨기기 (I키)';

  // 크기가 변경되므로 오버레이 다시 렌더링
  setTimeout(() => {
    renderOverlays();
  }, 100);
}

// 윈도우 리사이즈 핸들러
function handleResize() {
  // 위치 비율 유지하며 재렌더링
  renderOverlays();
}

// 초기화
function init() {
  // 이벤트 리스너 등록
  elements.myMonitorSelect.addEventListener('change', handleMyMonitorChange);
  elements.resetBtn.addEventListener('click', resetPositions);
  elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
  elements.immersiveBtn.addEventListener('click', toggleImmersive);
  window.addEventListener('resize', handleResize);

  // 키보드 단축키
  document.addEventListener('keydown', (e) => {
    // 입력 필드에서는 단축키 무시
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'Escape') {
      if (elements.app.classList.contains('immersive')) {
        toggleImmersive();
      } else if (elements.app.classList.contains('fullscreen')) {
        toggleFullscreen();
      }
    }
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
    if (e.key === 'i' || e.key === 'I') {
      toggleImmersive();
    }
    if (e.key === 'r' || e.key === 'R') {
      resetPositions();
    }
  });

  // 초기 상태 설정
  createCompareOptions();
  updateMyMonitorLabel();
  updateInfoPanel();
}

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', init);
