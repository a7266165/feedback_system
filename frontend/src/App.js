import React, {useState, useRef} from 'react';
import {Calendar, momentLocalizer} from 'react-big-calendar';
import moment from 'moment';
import D3Map from './components/D3Map';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import './css/General.css';
import './css/LoginPage.css';
import './css/UtilsPage.css';
import './css/Note.css';
import './css/MapSetting.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

function App () {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/utils" element={<Utils />} />
          <Route path="/utils/notes" element={<UtilsNotes />} />
          <Route path="/utils/search" element={<UtilsSearch />} />
          <Route path="/utils/poster" element={<UtilsPoster />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

// 登入表單組件
function LoginForm () {
  const navigate = useNavigate ();
  const [account, setAccount] = useState ('');
  const [password, setPassword] = useState ('');

  const handleFetchError = error => {
    // 處理伺服器連線錯誤
    if (!navigator.onLine) {
      alert ('錯誤: 請檢查網路連線');
    } else if (
      error.message === 'Failed to fetch' ||
      error.name === 'TypeError'
    ) {
      alert ('錯誤: 無法連接到伺服器，請確認伺服器是否已啟動');
    } else {
      alert ('錯誤: ' + error.message);
    }
  };

  const registerUser = async () => {
    if (!account || !password) {
      alert ('請輸入帳號和密碼！');
      return;
    }

    try {
      const response = await fetch ('http://localhost:3000/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify ({account, password}),
      });

      if (response.ok) {
        const data = await response.text ();
        alert (data);
      } else if (response.status === 409) {
        throw new Error ('已有人使用此帳號註冊');
      } else {
        throw new Error ('因其它原因造成註冊失敗，請連繫管理員');
      }
    } catch (error) {
      handleFetchError (error);
    }
  };

  const loginUser = async () => {
    if (!account || !password) {
      alert ('請輸入帳號和密碼！');
      return;
    }

    try {
      const response = await fetch ('http://localhost:3000/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify ({account, password}),
      });

      if (response.ok) {
        const data = await response.text ();
        alert (data);
        navigate ('/utils');
      } else if (response.status === 401) {
        throw new Error ('密碼錯誤');
      } else if (response.status === 404) {
        throw new Error ('帳號不存在');
      } else if (response.status === 500) {
        throw new Error ('登入失敗');
      } else {
        throw new Error ('因其它原因造成登入失敗，請連繫管理員');
      }
    } catch (error) {
      handleFetchError (error);
    }
  };

  return (
    <div className="background">
      <div className="login-container">
        <div className="login-title">
          <div className="system-icon" />
          <span className="system-name-word">小草協會<br />記事系統</span>
        </div>

        <div className="login-form">
          <div className="account-section">
            <label className="account-label">帳號</label>
            <input
              type="text"
              className="account-input-box"
              value={account}
              onChange={e => setAccount (e.target.value)}
              placeholder="請輸入帳號"
            />
          </div>

          <div className="password-section">
            <span className="password-word">密碼</span>
            <input
              type="password"
              className="password-input-box"
              value={password}
              onChange={e => setPassword (e.target.value)}
              placeholder="請輸入密碼"
            />
          </div>

          <div className="button-group">
            <button className="regist-button" onClick={registerUser}>
              <span className="regist-word">註冊</span>
            </button>
            <button className="login-button" onClick={loginUser}>
              <span className="login-word">登入</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 功能頁面
function Utils () {
  const navigate = useNavigate ();

  return (
    <div className="background">
      <div className="utils-container">
        <h1 className="utils-title">功能</h1>
        <button
          className="utils-button"
          onClick={() => navigate ('/utils/notes')}
        >
          記事
        </button>
        <button
          className="utils-button"
          onClick={() => navigate ('/utils/search')}
        >
          查詢
        </button>
        <button
          className="utils-button"
          onClick={() => navigate ('/utils/poster')}
        >
          生成海報
        </button>
      </div>
    </div>
  );
}

// 子頁面組件 - 記事
function UtilsNotes () {
  // D3Map 子元件的 ref，用來呼叫 resetMap
  const d3MapRef = useRef (null);

  const [officialType, setOfficialType] = useState (null); // 新增官方/非官方狀態
  const [selectedEvent, setSelectedEvent] = useState (null);
  const [description, setDescription] = useState ('');
  const [uploadedFileName, setUploadedFileName] = useState (null);
  const [selectedRegion, setSelectedRegion] = useState (null);
  const [selectedDate, setSelectedDate] = useState (''); // 日期
  const [startTime, setStartTime] = useState (''); // 開始時間
  const [endTime, setEndTime] = useState (''); // 結束時間
  const [detailedAddress, setDetailedAddress] = useState ('');
  const navigate = useNavigate ();

  // 處理事件類型選擇
  const handleOfficialSelect = type => {
    setOfficialType (type);
    setSelectedEvent (null); // 重置已選擇的事件類型
  };

  // 處理圖片上傳
  const handleImageUpload = event => {
    const file = event.target.files[0];
    if (file) {
      setUploadedFileName (file.name);
    } else {
      setUploadedFileName (null);
    }
  };

  // 處理提交
  const handleSubmit = async () => {
    const formData = new FormData ();
    const eventDescription = `${officialType === 'official' ? '官方' : '非官方'} - ${selectedEvent}`;
    formData.append ('address', `${selectedRegion}, ${detailedAddress}`);
    formData.append ('event', eventDescription);
    formData.append ('description', description);
    formData.append ('dateTime', `${selectedDate} 從 ${startTime} 到 ${endTime}`);

    // 添加圖片文件到表單數據
    const fileInput = document.querySelector ('input[type="file"]');
    if (fileInput.files[0]) {
      formData.append ('image', fileInput.files[0]);
    }

    try {
      const response = await fetch ('http://localhost:3000/report', {
        method: 'POST',
        body: formData, // 注意這裡不設置'Content-Type'，讓瀏覽器自動設置
      });
      if (response.ok) {
        const result = await response.text ();
        alert (`提交成功！\n${result}`);
        navigate ('/utils');
      } else {
        throw new Error ('網絡響應不是OK');
      }
    } catch (error) {
      console.error ('提交失敗:', error);
      alert ('提交過程中發生錯誤');
    }
  };

  // 重置地圖：呼叫子元件的 resetMap
  const handleResetMap = () => {
    if (d3MapRef.current) {
      d3MapRef.current.resetMap ();
      // 同時也清除目前選到的區域
      setSelectedRegion (null);
    }
  };

  const isSubmitDisabled =
    !selectedRegion ||
    !selectedEvent ||
    !description.trim () ||
    !selectedDate ||
    !startTime ||
    !endTime;

  const eventOptions = {
    official: ['集會', '其它'],
    unofficial: ['婚', '喪', '喜', '慶', '其它'],
  };

  return (
    <div className="split-container">
      {/* 左側地圖 */}
      <div className="map-section">
        <D3Map
          ref={d3MapRef}
          onRegionSelect={regionName => setSelectedRegion (regionName)}
        />
      </div>

      {/* 右側表單 */}
      <div className="form-section">
        <div className="info-box">
          <div className="section-title">選擇地點</div>
          <div>
            {selectedRegion ? `地址: ${selectedRegion}` : '請在左側地圖上點擊任一位置...'}
            <input
              type="text"
              className="address-input"
              placeholder="詳細地址..."
              value={detailedAddress}
              onChange={e => setDetailedAddress (e.target.value)}
            />
          </div>
          <button className="reset-button" onClick={handleResetMap}>
            重置地圖
          </button>
        </div>

        {/* 事件種類 */}
        <div className="info-box">
          <div>
            <div className="section-title">選擇官方性質</div>
            <button
              className={`official-button ${officialType === 'official' ? 'active' : ''}`}
              onClick={() => handleOfficialSelect ('official')}
            >
              官方
            </button>
            <button
              className={`official-button ${officialType === 'unofficial' ? 'active' : ''}`}
              onClick={() => handleOfficialSelect ('unofficial')}
            >
              非官方
            </button>
          </div>
          {officialType &&
            <div>
              <div className="section-title">選擇事件種類</div>
              <div className="event-buttons">
                {eventOptions[officialType].map (type => (
                  <button
                    key={type}
                    className={`event-button ${selectedEvent === type ? 'active' : ''}`}
                    onClick={() => setSelectedEvent (type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>}
        </div>

        {/* 詳細描述 */}
        <div className="info-box">
          <div className="section-title">詳細描述</div>
          <textarea
            className="textarea-field"
            rows="4"
            placeholder="輸入詳細描述..."
            value={description}
            onChange={e => setDescription (e.target.value)}
          />
        </div>

        {/* 選擇時間 */}
        <div className="info-box">
          <div className="section-title">選擇時間</div>
          <input
            type="date"
            className="date-input"
            value={selectedDate}
            onChange={e => setSelectedDate (e.target.value)}
            placeholder="選擇日期"
          />
          <input
            type="time"
            className="time-input"
            value={startTime}
            onChange={e => setStartTime (e.target.value)}
            placeholder="開始時間"
          />
          <input
            type="time"
            className="time-input"
            value={endTime}
            onChange={e => setEndTime (e.target.value)}
            placeholder="結束時間"
          />
        </div>

        {/* 上傳圖片 */}
        <div className="info-box">
          <div className="section-title">上傳圖片</div>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="file-input"
          />
          <p className="file-info">
            {uploadedFileName ? `已上傳圖片：${uploadedFileName}` : '尚未上傳圖片'}
          </p>
        </div>

        {/* 提交按鈕 */}
        <button
          className="report-button"
          disabled={isSubmitDisabled}
          onClick={handleSubmit}
        >
          提交回報
        </button>

        {/* 返回按鈕 */}
        <button className="back-button" onClick={() => navigate ('/utils')}>
          返回
        </button>
      </div>
    </div>
  );
}

// 子頁面組件 - 查詢
function UtilsSearch () {
  const d3MapRef = useRef (null);
  const [selectedRegion, setSelectedRegion] = useState ('');
  const [events, setEvents] = useState ([]); // 用於儲存從後端獲得的事件資料
  const localizer = momentLocalizer (moment);
  const [selectedEvent, setSelectedEvent] = useState (null);
  const navigate = useNavigate ();

  // 處理地圖上地區的選擇
  const handleRegionSelect = regionName => {
    setSelectedRegion (regionName);
  };

  // 重置地圖：呼叫子元件的 resetMap
  const handleResetMap = () => {
    if (d3MapRef.current) {
      d3MapRef.current.resetMap ();
      // 同時也清除目前選到的區域
      setSelectedRegion (null);
    }
  };

  // 處理查詢按鈕點擊
  const handleSearch = async () => {
    try {
      const response = await fetch (
        `http://localhost:3000/events?address=${encodeURIComponent (selectedRegion)}`
      );
      if (!response.ok) {
        throw new Error ('網絡響應不是OK');
      }
      const data = await response.json ();
      setEvents (data); // 將查詢結果儲存到狀態中
      alert (`查詢成功，共找到${data.length}個事件`);

      // 打印每個事件的圖片路徑到控制台
    } catch (error) {
      console.error ('查詢失敗:', error);
      alert ('查詢過程中發生錯誤');
    }
  };

  const handleSelectEvent = (event) => {
    // 直接使用 originalEvent
    const fullEvent = event.originalEvent;
    setSelectedEvent(fullEvent);
  };

  const parseDateTime = dateTimeString => {
    // 分割日期和時間範圍
    const [date, timeRange] = dateTimeString.split (' 從 ');
    const [startTime, endTime] = timeRange.split (' 到 ');

    // 建立開始和結束時間
    const startDateTime = new Date (`${date}T${startTime}`);
    const endDateTime = new Date (`${date}T${endTime}`);

    return {start: startDateTime, end: endDateTime};
  };

  return (
    <div className="split-container">
      <div className="map-section">
        <D3Map ref={d3MapRef} onRegionSelect={handleRegionSelect} />
      </div>
      <div className="form-section">
        <div className="info-box">
          <div className="section-title">選擇地點</div>
          <div>
            {selectedRegion ? `已選擇地點: ${selectedRegion}` : '請在左側地圖上選擇地點'}
          </div>
          <button className="search-button" onClick={handleSearch}>
            查詢
          </button>
          <button className="reset-button" onClick={handleResetMap}>
            重置
          </button>
        </div>
        <Calendar
          localizer={localizer}
          events={events.map (event => ({
            title: `${event.event}`,
            ...parseDateTime (event.dateTime),
            allDay: false,
            originalEvent: event, // 儲存完整事件物件
          }))}
          onSelectEvent={handleSelectEvent}
          style={{ 
            height: '600px',  // 增加高度
            width: '100%'     // 寬度佔滿容器
          }}
          // 其餘部分保持不變
        />
        {selectedEvent &&
          <div className="event-details">
            <h3>{selectedEvent.event}</h3>
            <p>地點：{selectedEvent.address}</p>
            <p>時間：{selectedEvent.dateTime}</p>
            {selectedEvent.description && <p>描述：{selectedEvent.description}</p>}
            {selectedEvent.imagePath &&
              <img
                src={`http://localhost:3000/${selectedEvent.imagePath}`}
                alt={selectedEvent.event}
                style={{maxWidth: '300px', maxHeight: '300px'}}
              />}
            <button onClick={() => setSelectedEvent (null)}>關閉</button>
          </div>}
          
        {/* 返回按鈕 */}
        <button className="back-button" onClick={() => navigate ('/utils')}>
          返回
        </button>
      </div>
    </div>
  );
}

function UtilsPoster () {
  return (
    <div>
      <h1>海報生成頁面</h1>
      {/* 在這裡實作海報生成功能 */}
    </div>
  );
}

export default App;
