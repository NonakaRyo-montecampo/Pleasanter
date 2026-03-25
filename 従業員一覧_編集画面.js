//従業員一覧 編集画面
//実装機能: 通勤経路保存機能関連の制御

//通勤経路有無のチェックボックスにチェックを入れたとき、出発駅・到着駅・途中経路を入力する欄が表示されるようにするコード
//また、乗換回数に数値を入力すると、その数値分だけ経路と交通手段の欄が表示されるようにするコード
const triggerId = 'CheckA'; //通勤経路有無チェックボックス
const changeNum = 'NumB'; //乗換回数入力欄(数値)
const changeStaIds = ['ClassJ', 'ClassL', 'ClassN']; //途中経路1~3入力欄(テキスト)
//const loadIds = ['ClassK', 'ClassM', 'ClassO']; //途中経路交通手段1~3入力欄(テキスト)

// 表示/非表示を切り替えたい項目のIDリスト
const targetIds = ['ClassH', 'ClassI', 'ClassS', changeNum]; //ClassH:出発駅, ClassI: 到着駅, ClassK: 交通手段, changeNum: 乗換回数(上部で定義)

//途中経路数に応じて経路と交通手段の欄が表示されるようにする関数.
//引数qty: 乗換回数, clear: データ非表示時にデータを削除するか
function ShowChangeStation(qty, clear){
  //表示
  for(let i = 0; i < changeStaIds.length; i++){
    //表示
    if(i < parseInt(qty)){
      $('#' + $p.getField(changeStaIds[i])[0].id).show();
      //$('#' + $p.getField(loadIds[i])[0].id).show();
    }
    //非表示&データクリア
    else{
      if(clear){
        $p.set($p.getControl(changeStaIds[i]), '')
        //$p.set($p.getControl(loadIds[i]), '')  
      }
      $('#' + $p.getField(changeStaIds[i])[0].id).hide();
      //$('#' + $p.getField(loadIds[i])[0].id).hide();
    }
  }
}

//main関数
$p.events.on_editor_load = function () {

  //編集画面起動時に項目非表示化
  targetIds.forEach(function(id) {
    let classField = $p.getField(id)[0].id;
    if(document.getElementById($p.tableName() + '_' + triggerId).checked){
      $('#' + classField).show()
      ShowChangeStation(parseInt($p.getValue(changeNum)), false);
    }
    else{
      ShowChangeStation(0, false);
      $('#' + classField).hide()
    }
  });

  //チェックボックスオンオフ切り替え時の対応
  $p.on('change', triggerId, function () {
    targetIds.forEach(function(id) {
      let classField = $p.getField(id)[0].id;
      if(document.getElementById($p.tableName() + '_' + triggerId).checked){
        $('#' + classField).show()
        ShowChangeStation(parseInt($p.getValue(changeNum)), false);
      }
      else{
        ShowChangeStation(0, false);
        $('#' + classField).hide()
      }
    });
  });

  //乗換回数の値変更時の対応
  $p.on('change', changeNum, function () {
    let changeqty = parseInt($p.getControl(changeNum).val());
    ShowChangeStation(changeqty, false);
  });
}

//データ保存直前に通勤経路有無及び乗換回数によって、非表示項目を削除
$p.events.before_send = function (args) {
  //通勤経路有無のチェックが外れている場合、出発駅、到着駅、交通手段を削除し乗換回数を0にする
  if(!document.getElementById($p.tableName() + '_' + triggerId).checked){
    $p.set($p.getControl(targetIds[0]), ''); //出発駅
    $p.set($p.getControl(targetIds[1]), ''); //到着駅
    $p.set($p.getControl(targetIds[2]), ''); //交通手段
    $p.set($p.getControl(targetIds[3]), 0); //乗換回数
  }
  //乗換回数による経路削除
  ShowChangeStation(parseInt($p.getValue(changeNum)), true);
  return true;
}