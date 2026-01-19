$p.events.on_grid_load = function () {

  //#region <定数定義>
  //============================================================
  //共通
  const SYSDATA_TABLEID = 15461409; //システム情報データベーステーブルID
  //レコード非表示処理用
  const ADMIN_DEPT_CODEs = [1]; //管理権限のある部署コード

  //PDF出力処理用
  //GAS用API URL
  const GAS_TRANSREPO_URL = 'https://script.google.com/macros/s/AKfycbwWJkjdOO-zTsAnxlhY3LAU9PfMZ_UhFHzSDqd_wEUJ7aOJ6XuEnUhjowNq5-zNxSBv/exec';
  const HEADER_NAMES = {
      date: '利用日',       // 画面上のヘッダー名
      user: '利用者',       // 画面上のヘッダー名
      destination: '行先',  // 画面上のヘッダー名
      dep: '利用区間(発)',
      arr: '利用区間(着)',
      way: '交通手段',
      trip: '片道/往復',
      amount: '金額',
      memo: '備考',
      status: '状況'
  };
  const STATUS_FIX = '承認完了';
  //============================================================
  //#endregion

  //#region <関数定義>
  //============================================================
  // ▼Promise化用のヘルパー関数（この関数を通してapiGetを呼ぶとawaitできるようになる）
  const apiGetAsync = (jsonfile) => {
      return new Promise((resolve, reject) => {
        jsonfile.done = function(data) {resolve(data);};
        jsonfile.fail = function(data) {reject(data);};
        $p.apiGet(jsonfile);
      });
  };
  // 日付文字列からMM/DDだけを抽出する便利関数
  function formatToMMDD(dateStr) {
      if (!dateStr) return "";
      // 正規表現で MM/DD 部分を抽出
      var match = dateStr.match(/\d{4}\/(\d{1,2}\/\d{1,2})/);
      return match ? match[1] : dateStr; // マッチしたらMM/DDを返す、しなければ元の文字を返す
  }
  //============================================================
  //#endregion

  //#region <権限のないレコード非表示処理>
  //===================================================================
  //1. 自身が管理者 or 総務管理部であれば何もしない
  //============================================================
  //ユーザの所属ID取得
  var deptcode = 0;
  console.log('ユーザID:' + $p.userId());
  $p.apiUsersGet({
    id: $p.userId(),
    done: function (data) {
      console.log(data);
      deptcode = data.Response.Data[0].DeptCode;
      console.log('ユーザ情報の取得に成功しました。所属ID:' + deptcode);
    },
    fail: function () {
      console.log('ユーザ情報の取得に失敗しました。(スクリプトID:2)');
      //すべて非表示
      
      return;
    }
  });
  
  //所属IDが管理権限があるか確認
  if(ADMIN_DEPT_CODEs.indexOf(deptcode) != -1){
    //管理権限に基づき非表示処理をしない
    alert('管理者の検知をしました。');
    return;
  }
  //=============================================================
  
  //自身が申請者のレコードをメモ
  //============================================================

  //============================================================

  //自身が担当者のレコードをメモ
  //============================================================

  //============================================================

  //非該当レコードをすべて非表示
  //============================================================

  //============================================================
//===================================================================
//#endregion

  //#region <清算書PDF出力処理>
  //===================================================================
  // 1. 画面下部（コマンドエリア）にボタンを追加
  // ※ $p.events.on_grid_load は一覧画面を開いた時に動きます
  $('#MainCommands').append('<button id="BtnPrintPdf" class="button button-icon ui-button ui-corner-all ui-widget">PDF出力</button>');

  // 2. ボタンクリック時の処理
  $('#BtnPrintPdf').on('click', async function() {
    try{
      //GAS_URLの読み込み
      //送信するjsonデータ作成
      var sysjson_gasurl = {
        id: SYSDATA_TABLEID,
        data: {
          View: {
            //ApiDataType: "KeyValues",
            ColumnFilterHash:{
              Title: "GAS_URL"
            }
          }
        }
      };
      //テーブルデータ読み取り
      /*
      const sysdata = await apiGetAsync(sysjson_gasurl);
      console.log('システムデータ読み取り処理完了');
      console.log(sysdata);
      //レコード内部テキストデータ抽出
      const gasurl = sysdata.Response.Data[0]['ClassA'];  //ClassA・・・data_textの位置
      */
      // 1. まず「どの項目が何列目にあるか」を調べる
      // (列番号を入れる箱を用意)
      var colIndex = {};
      
      // ヘッダー行(th)を全部見て、日本語が一致する列番号を覚える
      $('#Grid thead th').each(function(index) {
          var text = $(this).text().trim();
          // 見出しの中に「利用日」などの文字が含まれていたら、その列番号(index)を保存
          for (var key in HEADER_NAMES) {
              if (text === HEADER_NAMES[key]) {
                  colIndex[key] = index;
              }
          }
      });

      // チェック
      console.log('列の検出結果:', colIndex);

      // ★ここがポイント：チェックされたレコードのIDを配列で取得する標準メソッド
      var checkedIds = $p.selectedIds();

      // チェックがなければアラート
      if (checkedIds.length === 0) {
        alert('PDFに出力したいレコードにチェックを入れてください。');
        return;
      }

      // 3. ユーザーに確認
      if (!confirm(checkedIds.length + '件のデータをPDF出力しますか？')) {
        return;
      }
      
      // 3. データ収集
      var sendDataList = [];
      var username = '';
      
      // 各行からデータを取得
      // ※項目IDなどは環境に合わせて調整済みと想定
      $('#Grid .grid-row').each(function() {
        var row = $(this);
        var recordId = row.data('id');

        // IDが一致するかチェック（数値と文字列の型違いを吸収するため == を推奨）
        // checkedIdsに含まれるIDを探す
        if (checkedIds.some(id => id == recordId)) {
          var rowData = {
              //伝送データ: 名前, 日付, 行先, 交通手段, 出発, 到着, 片道/往復, 金額, 備考
              //データ識別に使用: 状況
              "id": recordId,
              "date": formatToMMDD(colIndex.date !== undefined ? row.find('td').eq(colIndex.date).text().trim() : ""),
              "user": colIndex.user !== undefined ? row.find('td').eq(colIndex.user).text().trim() : "",
              "destination": colIndex.destination !== undefined ? row.find('td').eq(colIndex.destination).text().trim() : "",
              "dep": colIndex.dep !== undefined ? row.find('td').eq(colIndex.dep).text().trim() : "",
              "arr": colIndex.arr !== undefined ? row.find('td').eq(colIndex.arr).text().trim() : "",
              "way": colIndex.way !== undefined ? row.find('td').eq(colIndex.way).text().trim() : "",
              "trip": colIndex.trip !== undefined ? row.find('td').eq(colIndex.trip).text().trim() : "",
              "amount": colIndex.amount !== undefined ? row.find('td').eq(colIndex.amount).text().trim() : "",
              "memo": colIndex.memo !== undefined ? row.find('td').eq(colIndex.memo).text().trim() : "",
              "status": colIndex.status !== undefined ? row.find('td').eq(colIndex.status).text().trim() : ""
          };

          //※初めの一回のみ 利用者を記録(複数の利用者)になることを避けるため
          if(username === ''){
              username = rowData.user;
          }
          //3.5.1 利用者情報のチェック(全員同じ人物になっているか)
          if(rowData.user != username){
              alert('複数の利用者が含まれています。すべて同じ利用者になるよう申請を選択してください。');
              return;
          }
          //3.5.2 すべて状態が「承認完了」かどうか
          if(rowData.status != STATUS_FIX){
              alert('承認が完了していない申請内容が含まれています。総務の承認が完了した申請のみを選択してください。');
              return;
          }
          
          sendDataList.push(rowData);
        }
      });
      console.log(sendDataList);

      // 4. GASへ送信 (ここが新規部分)
      $.ajax({
        type: 'POST',
        //url: GAS_APIURL,
        //url: gasurl,
        url: GAS_TRANSREPO_URL,
        // CORS対策のため text/plain で送るのが一番安定します
        contentType: 'text/plain', 
        data: JSON.stringify(sendDataList),
        success: function(response) {
          try {
            var resJson = (typeof response === 'object') ? response : JSON.parse(response);
            // Base64のPDFデータがある場合
            if (resJson.pdfBase64) {
              // 1. Base64文字列をバイナリデータに変換
              var bin = atob(resJson.pdfBase64);
              var buffer = new Uint8Array(bin.length);
              for (var i = 0; i < bin.length; i++) {
                  buffer[i] = bin.charCodeAt(i);
              }
              
              // 2. ブラウザが扱える「Blob（ファイル）」オブジェクトを作成
              var pdfBlob = new Blob([buffer.buffer], { type: "application/pdf" });

              // 3. そのBlobを開くための使い捨てURLを生成
              var pdfUrl = window.URL.createObjectURL(pdfBlob);

              // 4. 別タブで開く
              window.open(pdfUrl, '_blank');
              
              //alert("PDFを作成しました。");

            } 
            else {
              // エラー時など
              alert("処理完了: " + resJson.message);
            }
          } 
          catch(e) {
              console.error(e);
              alert("レスポンスの処理に失敗しました。");
          }
        },
        error: function(xhr, status, error) {
          console.error("送信エラー:", error);
          alert("送信に失敗しました。コンソールログを確認してください。");
        }
      });
    }
    catch (error) {
          // apiGetAsyncの中で fail が起きたらここに飛びます
          alert("データの取得中にエラーが発生しました。");
          console.error(error);
    }
    
  // 例: printPdfProcess(checkedIds);
  });
//===================================================================
//#endregion
};